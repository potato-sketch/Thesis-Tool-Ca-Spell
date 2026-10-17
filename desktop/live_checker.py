"""Ca-Spell live checker: underlines misspelled words inside Notepad / Word while you type.

How it works
  * Windows UI Automation reads the text of the focused editor and the exact screen position of every word.
  * The text is sent to the Ca-Spell backend (http://127.0.0.1:8000/api/check).
  * Red squiggles are drawn on a transparent click-through window laid over the editor.
  * Click an underlined word to get a small suggestion popup; picking one types it over the word.

Run it with `npm run desktop` (see the README), or directly: desktop\\.venv\\Scripts\\python.exe live_checker.py
"""
import argparse
import ctypes
import json
import os
import queue
import sys
import threading
import time
import tkinter as tk
import urllib.error
import urllib.request
from ctypes import wintypes

# Must happen before any window exists, so UI Automation and Tk both work in real screen pixels.
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    ctypes.windll.user32.SetProcessDPIAware()

import uiautomation as auto  # noqa: E402

MAX_CHARS = 10000  # the backend rejects anything longer
MAX_MARKS = 80  # underline at most this many words per pass
TICK_MS = 250
MOUSE_MS = 30
KEY_COLOR = "#010203"  # drawn as fully transparent
MAROON = "#800000"
UNDERLINE = "#ff8a00"  # orange, so it is not mistaken for Notepad's own red English-only spell check

user32 = ctypes.WinDLL("user32", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.GetModuleHandleW.restype = wintypes.HMODULE
kernel32.GetModuleHandleW.argtypes = [wintypes.LPCWSTR]
user32.GetParent.restype = wintypes.HWND
user32.GetParent.argtypes = [wintypes.HWND]
user32.GetWindowLongW.restype = ctypes.c_long
user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
user32.SetWindowLongW.restype = ctypes.c_long
user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.UINT]
user32.SetWindowsHookExW.restype = ctypes.c_void_p
user32.CallNextHookEx.restype = ctypes.c_ssize_t
user32.CallNextHookEx.argtypes = [ctypes.c_void_p, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]

GWL_EXSTYLE = -20
WS_EX_TRANSPARENT, WS_EX_TOOLWINDOW, WS_EX_NOACTIVATE, WS_EX_LAYERED = 0x20, 0x80, 0x08000000, 0x80000
SWP_NOACTIVATE, SWP_SHOWWINDOW, SWP_HIDEWINDOW = 0x10, 0x40, 0x80
HWND_TOPMOST = wintypes.HWND(-1)
WM_LBUTTONUP = 0x0202
TextPatternRangeEndpoint = auto.TextPatternRangeEndpoint


def log(message):
    print(message, flush=True)


# --- small Win32 helpers ---------------------------------------------------------------------------

def process_name(pid):
    handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        return ""
    try:
        buffer = ctypes.create_unicode_buffer(1024)
        size = wintypes.DWORD(1024)
        if kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
            return os.path.basename(buffer.value).lower()
        return ""
    finally:
        kernel32.CloseHandle(handle)


def native_handle(window):
    window.update_idletasks()
    return user32.GetParent(window.winfo_id()) or window.winfo_id()


def mark_no_activate(hwnd, click_through):
    style = user32.GetWindowLongW(hwnd, GWL_EXSTYLE) | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW
    if click_through:
        style |= WS_EX_TRANSPARENT | WS_EX_LAYERED
    user32.SetWindowLongW(hwnd, GWL_EXSTYLE, style)


def place(hwnd, x, y, w, h):
    user32.SetWindowPos(hwnd, HWND_TOPMOST, int(x), int(y), int(w), int(h), SWP_NOACTIVATE | SWP_SHOWWINDOW)


def hide(hwnd):
    user32.SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 1, 1, SWP_NOACTIVATE | SWP_HIDEWINDOW)


class _KeyboardInput(ctypes.Structure):
    _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD),
                ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_size_t)]


class _MouseInput(ctypes.Structure):
    _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD),
                ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_size_t)]


class _InputUnion(ctypes.Union):
    _fields_ = [("ki", _KeyboardInput), ("mi", _MouseInput)]


class _Input(ctypes.Structure):
    _anonymous_ = ("u",)
    _fields_ = [("type", wintypes.DWORD), ("u", _InputUnion)]


def type_text(text):
    """Types text into whatever has the keyboard focus, as Unicode (no clipboard involved)."""
    data = text.encode("utf-16-le")
    units = [int.from_bytes(data[i:i + 2], "little") for i in range(0, len(data), 2)]
    events = []
    for unit in units:
        for flags in (0x0004, 0x0004 | 0x0002):  # KEYEVENTF_UNICODE, then key up
            item = _Input(type=1)
            item.ki = _KeyboardInput(0, unit, flags, 0, 0)
            events.append(item)
    array = (_Input * len(events))(*events)
    user32.SendInput(len(events), array, ctypes.sizeof(_Input))


class MouseHook(threading.Thread):
    """Reports where the left mouse button was released, system-wide (a low-level hook)."""

    def __init__(self, out):
        super().__init__(daemon=True)
        self.out = out

    def run(self):
        class HookStruct(ctypes.Structure):
            _fields_ = [("pt", wintypes.POINT), ("mouseData", wintypes.DWORD), ("flags", wintypes.DWORD),
                        ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_size_t)]

        proto = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)

        def callback(code, wparam, lparam):
            if code >= 0 and wparam == WM_LBUTTONUP:
                point = HookStruct.from_address(lparam).pt
                self.out.put((point.x, point.y))
            return user32.CallNextHookEx(None, code, wparam, lparam)

        self._callback = proto(callback)  # keep a reference so it is not garbage collected
        user32.SetWindowsHookExW.argtypes = [ctypes.c_int, proto, wintypes.HMODULE, wintypes.DWORD]
        user32.SetWindowsHookExW(14, self._callback, kernel32.GetModuleHandleW(None), 0)  # WH_MOUSE_LL
        message = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(message), None, 0, 0) > 0:
            user32.TranslateMessage(ctypes.byref(message))
            user32.DispatchMessageW(ctypes.byref(message))


# --- backend -----------------------------------------------------------------------------------------

def post_json(api, path, payload, timeout=30):
    request = urllib.request.Request(f"{api}{path}", data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def context_snippet(body, start, end, reach=300):
    """The sentence around a word, so a suggestion request stays small and fast on big documents."""
    left = max(0, start - reach)
    for i in range(start - 1, left - 1, -1):
        if body[i] in ".!?\r\n":
            left = i + 1
            break
    right = min(len(body), end + reach)
    for i in range(end, right):
        if body[i] in ".!?\r\n":
            right = i + 1
            break
    return body[left:right], start - left, end - left


class Worker(threading.Thread):
    """Finds the misspelled words off the UI thread; only the newest request is ever answered."""

    def __init__(self, api):
        super().__init__(daemon=True)
        self.api = api
        self.jobs = queue.Queue()
        self.results = queue.Queue()

    def run(self):
        while True:
            text = self.jobs.get()
            while not self.jobs.empty():
                text = self.jobs.get_nowait()
            body = text.strip()
            lead = len(text) - len(text.lstrip())
            try:
                result = post_json(self.api, "/api/detect", {"text": body}, timeout=60)
                errors = [{**e, "body": body, "body_start": e["start"], "body_end": e["end"],
                           "start": e["start"] + lead, "end": e["end"] + lead} for e in result.get("errors", [])]
                self.results.put((text, errors, None))
            except Exception as error:  # network problems, backend still loading, HTTP errors
                self.results.put((text, None, error))


# --- the live checker --------------------------------------------------------------------------------

class Mark:
    def __init__(self, error, rects):
        self.error = error
        self.rects = rects

    def contains(self, x, y, pad=3):
        return any(r.left - pad <= x <= r.right + pad and r.top - pad <= y <= r.bottom + pad for r in self.rects)


class LiveChecker:
    def __init__(self, api, apps, delay, verbose):
        self.api, self.apps, self.delay, self.verbose = api, apps, delay, verbose
        self.root = tk.Tk()
        self.root.withdraw()

        self.overlay = tk.Toplevel(self.root)
        self.overlay.overrideredirect(True)
        self.overlay.configure(bg=KEY_COLOR)
        self.overlay.attributes("-topmost", True, "-transparentcolor", KEY_COLOR)
        self.canvas = tk.Canvas(self.overlay, bg=KEY_COLOR, highlightthickness=0, bd=0)
        self.canvas.pack(fill="both", expand=True)
        self.overlay_hwnd = native_handle(self.overlay)
        mark_no_activate(self.overlay_hwnd, click_through=True)
        hide(self.overlay_hwnd)

        self.popup = tk.Toplevel(self.root)
        self.popup.overrideredirect(True)
        self.popup.configure(bg=MAROON)
        self.popup.attributes("-topmost", True)
        self.popup_hwnd = native_handle(self.popup)
        mark_no_activate(self.popup_hwnd, click_through=False)
        hide(self.popup_hwnd)
        self.popup_rect = None

        self.worker = Worker(api)
        self.worker.start()
        self.clicks = queue.SimpleQueue()
        MouseHook(self.clicks).start()

        self.pattern = None
        self.editor_rect = None
        self.text = ""
        self.changed_at = 0.0
        self.sent_text = None
        self.retry_at = 0.0
        self.errors = []
        self.ignored = set()
        self.marks = []
        self.drawn = None
        self.warned = False
        self.popup_error = None
        self.suggest_results = queue.SimpleQueue()

    def run(self):
        self.root.after(TICK_MS, self.tick)
        self.root.after(MOUSE_MS, self.poll_mouse)
        try:
            self.root.mainloop()
        except KeyboardInterrupt:
            pass

    def tick(self):
        try:
            self.step()
        except Exception as error:  # elements vanish mid-call when you switch windows; just start over
            if self.verbose:
                log(f"[tick] {error!r}")
            self.reset()
        self.root.after(TICK_MS, self.tick)

    def reset(self):
        self.pattern = None
        self.text = ""
        self.sent_text = None
        self.errors = []
        self.marks = []
        self.drawn = None
        self.hide_popup()
        hide(self.overlay_hwnd)

    def step(self):
        control = auto.GetFocusedControl()
        if control is None:
            return self.reset()
        if "*" not in self.apps and process_name(control.ProcessId) not in self.apps:
            return self.reset()
        pattern = control.GetPattern(auto.PatternId.TextPattern)
        if pattern is None or control.IsPassword:
            return self.reset()

        self.pattern = pattern
        self.editor_rect = control.BoundingRectangle
        text = pattern.DocumentRange.GetText(MAX_CHARS)
        now = time.time()
        if text != self.text:
            self.text = text
            self.changed_at = now
            self.hide_popup()

        if text.strip() and text != self.sent_text and now - self.changed_at >= self.delay and now >= self.retry_at:
            self.sent_text = text
            self.worker.jobs.put(text)
        if not text.strip():
            self.errors = []

        while not self.worker.results.empty():
            sent, errors, failure = self.worker.results.get_nowait()
            if failure is not None:
                if not self.warned:
                    if isinstance(failure, urllib.error.HTTPError) and failure.code == 404:
                        log("The running backend is out of date (it has no /api/detect). Stop it with Ctrl+C and start it again: npm run backend")
                    else:
                        log(f"Cannot reach the Ca-Spell backend at {self.api} ({failure}). Is `npm run backend` running? Retrying...")
                    self.warned = True
                self.sent_text = None
                self.retry_at = time.time() + 5
            elif sent == self.sent_text:
                self.warned = False
                self.errors = errors

        self.marks = self.build_marks()
        self.draw()

    # -- locating words on screen --

    def range_for(self, start, end):
        doc = self.pattern.DocumentRange
        word = doc.Clone()
        word.MoveEndpointByRange(TextPatternRangeEndpoint.End, word, TextPatternRangeEndpoint.Start, waitTime=0)
        word.Move(auto.TextUnit.Character, start, waitTime=0)
        word.MoveEndpointByUnit(TextPatternRangeEndpoint.End, auto.TextUnit.Character, end - start, waitTime=0)
        return word

    def visible_span(self):
        """(start, end) character offsets of the part of the document currently on screen."""
        doc = self.pattern.DocumentRange
        try:
            ranges = self.pattern.GetVisibleRanges()
            if not ranges:
                return 0, len(self.text)
            head = doc.Clone()
            head.MoveEndpointByRange(TextPatternRangeEndpoint.End, ranges[0], TextPatternRangeEndpoint.Start, waitTime=0)
            tail = doc.Clone()
            tail.MoveEndpointByRange(TextPatternRangeEndpoint.End, ranges[-1], TextPatternRangeEndpoint.End, waitTime=0)
            return len(head.GetText(MAX_CHARS)), len(tail.GetText(MAX_CHARS))
        except Exception:
            return 0, len(self.text)

    def build_marks(self):
        marks = []
        view = self.editor_rect
        # Only look at words on screen: a pasted page of text can hold hundreds of errors.
        first, last = self.visible_span()
        for error in self.errors:
            if len(marks) >= MAX_MARKS:
                break
            if error["end"] < first or error["start"] > last:
                continue
            if error["text"].lower() in self.ignored:
                continue
            try:
                word = self.range_for(error["start"], error["end"])
                # The text may have changed since the check; only keep words that are still where they were.
                if word.GetText(-1) != error["text"]:
                    continue
                rects = [r for r in word.GetBoundingRectangles()
                         if r.width() > 0 and r.height() > 0 and r.right > view.left and r.left < view.right
                         and r.bottom > view.top and r.top < view.bottom]
            except Exception:
                continue
            if rects:
                marks.append(Mark(error, rects))
        return marks

    # -- drawing --

    def draw(self):
        if not self.marks:
            self.drawn = None
            hide(self.overlay_hwnd)
            return
        view = self.editor_rect
        signature = (view.left, view.top, view.right, view.bottom,
                     tuple((r.left, r.top, r.right, r.bottom) for m in self.marks for r in m.rects))
        if signature == self.drawn:
            return
        self.drawn = signature
        place(self.overlay_hwnd, view.left, view.top, view.width(), view.height())
        self.canvas.delete("all")
        for mark in self.marks:
            for rect in mark.rects:
                y = rect.bottom - 2 - view.top
                points = []
                x = rect.left - view.left
                high = False
                while x < rect.right - view.left:
                    points += [x, y + (0 if high else 2)]
                    high = not high
                    x += 3
                points += [rect.right - view.left, y + (0 if high else 2)]
                if len(points) >= 4:
                    self.canvas.create_line(*points, fill=UNDERLINE, width=1.8)

    # -- clicks and the suggestion popup --

    def poll_mouse(self):
        try:
            self.collect_suggestions()
            while not self.clicks.empty():
                x, y = self.clicks.get_nowait()
                if self.popup_rect and self.popup_rect[0] <= x <= self.popup_rect[2] and self.popup_rect[1] <= y <= self.popup_rect[3]:
                    continue  # the popup handles its own clicks
                self.hide_popup()
                for mark in self.marks:
                    if mark.contains(x, y):
                        self.show_popup(mark)
                        break
        except Exception as error:
            if self.verbose:
                log(f"[mouse] {error!r}")
        self.root.after(MOUSE_MS, self.poll_mouse)

    def hide_popup(self):
        self.popup_error = None
        if self.popup_rect:
            hide(self.popup_hwnd)
            self.popup_rect = None

    def fetch_suggestions(self, error):
        """Asks the backend for this one word's suggestions in the background."""
        error["loading"] = True
        snippet, start, end = context_snippet(error["body"], error["body_start"], error["body_end"])

        def job():
            try:
                reply = post_json(self.api, "/api/suggest", {"text": snippet, "start": start, "end": end}, timeout=120)
                self.suggest_results.put((error, reply.get("suggestions", [])))
            except Exception as failure:
                if self.verbose:
                    log(f"[suggest] {failure!r}")
                self.suggest_results.put((error, None))

        threading.Thread(target=job, daemon=True).start()

    def collect_suggestions(self):
        """Stores finished suggestion requests and refreshes the popup if it is showing that word."""
        while not self.suggest_results.empty():
            error, suggestions = self.suggest_results.get_nowait()
            error["loading"] = False
            if suggestions is None:
                error["failed"] = True
            else:
                error["suggestions"] = suggestions
            if self.popup_error is error and self.popup_rect:
                mark = next((m for m in self.marks if m.error is error), None)
                if mark:
                    self.show_popup(mark)

    def show_popup(self, mark):
        error = mark.error
        self.popup_error = error
        if "suggestions" not in error and not error.get("loading"):
            error.pop("failed", None)
            self.fetch_suggestions(error)
        for child in self.popup.winfo_children():
            child.destroy()
        body = tk.Frame(self.popup, bg="white")
        body.pack(padx=1, pady=1)
        font = ("Segoe UI", 10)

        header = tk.Label(body, text=f"“{error['text']}” may be misspelled", bg=MAROON, fg="white",
                          font=("Segoe UI", 9, "bold"), anchor="w", padx=10, pady=5)
        header.pack(fill="x")
        suggestions = [s["word"] for s in error.get("suggestions", [])][:5]
        if "suggestions" not in error:
            note = "Could not load suggestions" if error.get("failed") else "Finding suggestions…"
            tk.Label(body, text=note, bg="white", fg="#666", font=font, anchor="w", padx=10, pady=6).pack(fill="x")
        elif not suggestions:
            tk.Label(body, text="No suggestions", bg="white", fg="#666", font=font, anchor="w", padx=10, pady=6).pack(fill="x")
        for word in suggestions:
            self.option(body, word, lambda w=word: self.apply(mark, w), font, bold=True)
        self.option(body, "Ignore", lambda: self.ignore(error), font, bold=False)

        self.popup.update_idletasks()
        width, height = self.popup.winfo_reqwidth(), self.popup.winfo_reqheight()
        rect = mark.rects[0]
        x = min(rect.left, self.popup.winfo_screenwidth() - width - 8)
        y = rect.bottom + 6
        if y + height > self.popup.winfo_screenheight() - 8:
            y = rect.top - height - 6
        place(self.popup_hwnd, max(x, 0), max(y, 0), width, height)
        self.popup_rect = (x, y, x + width, y + height)

    def option(self, parent, text, command, font, bold):
        label = tk.Label(parent, text=text, bg="white", fg=MAROON if bold else "#555",
                         font=(font[0], font[1], "bold" if bold else "normal"), anchor="w", padx=10, pady=5, cursor="hand2")
        label.pack(fill="x")
        label.bind("<Enter>", lambda _e: label.configure(bg="#f7e9e9"))
        label.bind("<Leave>", lambda _e: label.configure(bg="white"))
        label.bind("<ButtonRelease-1>", lambda _e: command())

    def ignore(self, error):
        self.ignored.add(error["text"].lower())
        self.hide_popup()
        self.marks = self.build_marks()
        self.drawn = None
        self.draw()

    def apply(self, mark, replacement):
        error = mark.error
        self.hide_popup()
        try:
            word = self.range_for(error["start"], error["end"])
            if word.GetText(-1) != error["text"]:
                return  # the text changed under us; do nothing rather than overwrite the wrong word
            word.Select(waitTime=0)
        except Exception as failure:
            log(f"Could not select the word: {failure!r}")
            return
        self.root.after(60, lambda: type_text(replacement))


def wait_for_backend(api):
    announced = False
    while True:
        try:
            with urllib.request.urlopen(f"{api}/api/health", timeout=3):
                return
        except (urllib.error.URLError, OSError):
            if not announced:
                log(f"Waiting for the Ca-Spell backend at {api} (start it with `npm run backend`)...")
                announced = True
            time.sleep(2)


def main():
    parser = argparse.ArgumentParser(description="Underline misspelled Taglish words in Notepad / Word.")
    parser.add_argument("--api", default="http://127.0.0.1:8000", help="Ca-Spell backend URL")
    parser.add_argument("--apps", default="notepad.exe,winword.exe",
                        help="comma-separated program names to check, or * for every program")
    parser.add_argument("--delay", type=float, default=0.7, help="seconds to wait after you stop typing")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    apps = {name.strip().lower() for name in args.apps.split(",") if name.strip()}
    wait_for_backend(args.api)
    log(f"Ca-Spell live checker is running for: {', '.join(sorted(apps))}")
    log("Type in Notepad; misspelled words get an orange underline. Click one for suggestions. Press Ctrl+C here to stop.")
    LiveChecker(args.api, apps, args.delay, args.verbose).run()


if __name__ == "__main__":
    sys.exit(main())
