; Ca-Spell hotkey for desktop apps (MS Word, Notepad, anything with selectable text).
; Requires AutoHotkey v2 (https://www.autohotkey.com/) and the Ca-Spell backend running (npm run backend),
; with the web app built (npm run build) so http://127.0.0.1:8000/ serves it.
;
; Select text, press Ctrl+Shift+K: the text opens in Ca-Spell. Use its Copy button, then
; Ctrl+V back in Word/Notepad to replace your selection with the corrected text.
#Requires AutoHotkey v2.0

; ---- Settings (edit these, save the file, then reload the script) -------------------------------
; Avoid Alt or the Windows key in the combination: releasing them makes Notepad/Word show their menu
; shortcut hints (the F, E, V... letters) and the copy below then goes to the menu instead of your text.
HOTKEY_KEYS := "^+k"                     ; ^ = Ctrl, + = Shift, ! = Alt, # = Windows key. ^+k = Ctrl+Shift+K
APP_URL     := "http://127.0.0.1:8000/"  ; where the Ca-Spell app is served (keep the trailing slash)
MAX_CHARS   := 3000                      ; longest selection that is sent
; -------------------------------------------------------------------------------------------------

Hotkey(HOTKEY_KEYS, CheckSelection)

CheckSelection(*) {
    ; Let go of the hotkey modifiers first, otherwise the copy below is sent with Ctrl+Shift still held.
    KeyWait("Ctrl")
    KeyWait("Shift")
    KeyWait("Alt")
    KeyWait("LWin")
    saved := ClipboardAll()
    A_Clipboard := ""
    Send("^c")
    if !ClipWait(1) {
        A_Clipboard := saved
        ToolTip("Ca-Spell: select some text first")
        SetTimer(() => ToolTip(), -1500)
        return
    }
    text := A_Clipboard
    A_Clipboard := saved
    Run(APP_URL . "#text=" . UriEncode(SubStr(text, 1, MAX_CHARS)))
}

UriEncode(str) {
    buf := Buffer(StrPut(str, "UTF-8"))
    StrPut(str, buf, "UTF-8")
    out := ""
    loop buf.Size - 1 {
        b := NumGet(buf, A_Index - 1, "UChar")
        out .= (b >= 48 && b <= 57) || (b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b = 45 || b = 46 || b = 95 || b = 126
            ? Chr(b) : Format("%{:02X}", b)
    }
    return out
}
