import { useEffect, useRef, useState } from "react";
import Suggestions from "./Suggestions";
import TextType from "./TextType";
import DecryptedText from "./DecryptedText";
import Delete from "./assets/delete.png";
import Copy from "./assets/copy.png";
import Logo from "./assets/logo-no-bg.png";

function App() {
  const [text, setText] = useState("");
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const editorRef = useRef(null);
  const textOverlayRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const [isOpen, setIsOpen] = useState(false);
  const [flowPage, setFlowPage] = useState("landing");
  const [analysis, setAnalysis] = useState({
    tokens: [],
    errors: [],
    status: "idle",
    error: "",
  });

  useEffect(() => {
    const input = text.trim();
    if (!input) {
      setAnalysis({ tokens: [], errors: [], status: "idle", error: "" });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAnalysis((current) => ({ ...current, status: "loading", error: "" }));
      try {
        const response = await fetch("http://127.0.0.1:8000/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: input }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        const result = await response.json();
        // The backend reports offsets into the trimmed text; shift them back
        // onto the original text so they line up with the overlay.
        const offset = text.length - text.trimStart().length;
        setAnalysis({
          tokens: result.tokens ?? [],
          errors: (result.errors ?? []).map((error) => ({
            ...error,
            start: error.start + offset,
            end: error.end + offset,
          })),
          status: "ready",
          error: "",
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          setAnalysis({
            tokens: [],
            errors: [],
            status: "error",
            error: error.message,
          });
        }
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  const textParts =
    text.match(/\s+|[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*|[^\s\p{L}\p{M}]+/gu) ??
    [];
  // Only keep errors whose word is still at the same position, so stale
  // results from before the latest edit don't underline the wrong text.
  const errorWords = analysis.errors.filter(
    (error) => text.slice(error.start, error.end) === error.text,
  );
  const overlayParts = [];
  let wordIndex = 0;
  let partStart = 0;
  for (const part of textParts) {
    const isWord = /[\p{L}\p{M}]/u.test(part);
    const partEnd = partStart + part.length;
    overlayParts.push({
      part,
      isWord,
      wordIndex: isWord ? wordIndex++ : -1,
      isError:
        isWord &&
        errorWords.some(
          (error) => error.start < partEnd && error.end > partStart,
        ),
    });
    partStart = partEnd;
  }

  useEffect(() => {
    const revealItems = document.querySelectorAll(".scroll-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [flowPage]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleClear() {
    updateText("");
  }

  function updateText(nextText) {
    if (nextText === text) return;
    undoStackRef.current.push(text);
    redoStackRef.current = [];
    setText(nextText);
  }

  function handleUndo() {
    if (undoStackRef.current.length === 0) return;
    redoStackRef.current.push(text);
    setText(undoStackRef.current.pop());
  }

  function handleRedo() {
    if (redoStackRef.current.length === 0) return;
    undoStackRef.current.push(text);
    setText(redoStackRef.current.pop());
  }

  async function handleCopy() {
    try {
      const selectionStart = editorRef.current?.selectionStart ?? 0;
      const selectionEnd = editorRef.current?.selectionEnd ?? 0;
      const selectedText = text.slice(selectionStart, selectionEnd);
      await navigator.clipboard.writeText(selectedText || text);
    } catch {
      // Clipboard access may be unavailable outside a secure browser context.
    }
  }

  async function handlePaste() {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText) return;
      const selectionStart = editorRef.current?.selectionStart ?? text.length;
      const selectionEnd = editorRef.current?.selectionEnd ?? text.length;
      updateText(
        text.slice(0, selectionStart) +
          clipboardText +
          text.slice(selectionEnd),
      );
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        editorRef.current?.setSelectionRange(
          selectionStart + clipboardText.length,
          selectionStart + clipboardText.length,
        );
      });
    } catch {
      // Clipboard access may be unavailable outside a secure browser context.
    }
  }

  function handleAbout() {
    setFlowPage("landing");
    requestAnimationFrame(() => {
      document
        .getElementById("about-ca-spell")
        ?.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (flowPage === "landing") {
    return <LandingPage onLogin={() => setFlowPage("login")} />;
  }

  if (flowPage === "login") {
    return (
      <LoginPage
        onContinue={() => setFlowPage("app")}
        onBack={() => setFlowPage("landing")}
        onCreateAccount={() => setFlowPage("register")}
      />
    );
  }

  if (flowPage === "register") {
    return (
      <CreateAccountPage
        onBack={() => setFlowPage("login")}
        onBackToLogin={() => setFlowPage("login")}
      />
    );
  }

  return (
    <div>
      <nav className="bg-linear-to-r from-[#f6f0ed] via-[#eadfe3] to-[#dfe0eb] px-3 py-2 shadow-sm lg:px-5 lg:py-2">
        <div className="flex items-center justify-between ">
          <div className="flex min-w-0 items-center">
            <img
              src={Logo}
              alt="CA Spell logo"
              className="h-12 w-auto max-w-[170px] object-contain drop-shadow-[0_2px_6px_rgba(56,36,95,0.08)] sm:h-11 lg:h-12 lg:max-w-[220px]"
            />
          </div>
          <button
            type="button"
            onClick={() => setFlowPage("landing")}
            className="border-b border-[#74191d] px-1 py-1 font-primary text-m font-medium text-[#54151a] transition-colors hover:text-[#8c1d35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74191d]"
          >
            Home
          </button>
          {/* <ul className="hidden items-center gap-7 font-primary text-base font-medium text-[#252545] md:flex lg:gap-4 lg:text-xl">
            <li>
              <button
                type="button"
                onClick={() => setFlowPage("app")}
                className="border-b-2 border-[#252545] px-4 py-1 transition-colors duration-200 hover:border-[#252545]"
              >
                Home
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={handleAbout}
                className="border-b-2 border-transparent px-4 py-1 transition-colors duration-200 hover:border-[#252545]"
              >
                About
              </button>
            </li>
          </ul> */}

          {/* <div className="md:hidden">
            <button
              onMouseDown={(event) => event.stopPropagation()}
              onClick={() => setIsOpen(!isOpen)}
              className="text-[#252545] transition-colors hover:text-[#8c1d35] focus:outline-none"
              aria-label="Toggle Menu"
            >
              {isOpen ? (
                <svg
                  className="h-7 w-7 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-7 w-7 transition-transform duration-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div> */}

          <ul
            ref={mobileMenuRef}
            className={`absolute left-0 top-0 z-30 flex w-full flex-col items-center overflow-hidden border-t border-[#cbbbc3] bg-[#ffffff] text-[#252545] shadow-lg transition-all duration-300 ease-out md:hidden ${
              isOpen
                ? "pointer-events-auto max-h-60 space-y-4 py-6 opacity-100"
                : "pointer-events-none max-h-0 space-y-0 py-0 opacity-0"
            }`}
          >
            <li>
              <a
                href="#home"
                onClick={(event) => {
                  event.preventDefault();
                  setFlowPage("app");
                  setIsOpen(false);
                }}
                className="border-b-2 border-transparent pb-1 transition-colors duration-200 hover:border-[#8c1d35] hover:text-[#8c1d35]"
              >
                Home
              </a>
            </li>
            <li>
              <a
                href="#about"
                onClick={(event) => {
                  event.preventDefault();
                  handleAbout();
                  setIsOpen(false);
                }}
                className="border-b-2 border-transparent pb-1 transition-colors duration-200 hover:border-[#8c1d35] hover:text-[#8c1d35]"
              >
                About
              </a>
            </li>
          </ul>
        </div>
      </nav>

      <main className="page-enter px-4">
        <section className="scroll-reveal flex min-h-[calc(100dvh-5rem)] flex-col gap-4 py-4">
          <div className="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-4">
            <div className="col-span-1 flex min-h-[55vh] flex-col border-gray shadow-md transition duration-300 hover:shadow-xl focus:outline-none lg:col-span-3 lg:min-h-0">
              <div className="flex flex-row p-3 bg-[#800000] justify-between text-white">
                <h2 className="min-w-0 truncate text-base font-bold sm:text-lg lg:text-2xl">
                  Original Text
                </h2>
                <div className="flex shrink-0 flex-row gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStackRef.current.length === 0}
                    aria-label="Undo"
                    title="Undo"
                    className="grid h-7 w-7 place-items-center rounded bg-white text-lg text-black transition hover:scale-105 hover:text-[#800000] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none sm:h-8 sm:w-8 sm:text-xl"
                  >
                    <span aria-hidden="true">↶</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStackRef.current.length === 0}
                    aria-label="Redo"
                    title="Redo"
                    className="grid h-7 w-7 place-items-center rounded bg-white text-lg text-black transition hover:scale-105 hover:text-[#800000] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none sm:h-8 sm:w-8 sm:text-xl"
                  >
                    <span aria-hidden="true">↷</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label="Copy text"
                    title="Copy text"
                    className="grid h-7 w-7 place-items-center rounded bg-white transition hover:scale-105 hover:shadow-md active:scale-95 sm:h-8 sm:w-8"
                  >
                    <img src={Copy} alt="" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handlePaste}
                    aria-label="Paste text"
                    title="Paste text"
                    className="grid h-7 w-7 place-items-center rounded bg-white text-base text-black transition hover:scale-105 hover:text-[#800000] hover:shadow-md active:scale-95 sm:h-8 sm:w-8 sm:text-lg"
                  >
                    <span aria-hidden="true">▤</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear text"
                    title="Clear text"
                    className="grid h-7 w-7 place-items-center rounded bg-white transition hover:scale-105 hover:shadow-md active:scale-95 sm:h-8 sm:w-8"
                  >
                    <img src={Delete} alt="" className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="relative flex-1">
                <div
                  ref={textOverlayRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-20 overflow-hidden whitespace-pre-wrap wrap-break-word rounded-b border border-transparent p-4 text-left text-transparent leading-10 lg:text-2xl"
                  style={{ lineHeight: "2.5rem" }}
                >
                  {overlayParts.map(
                    ({ part, isWord, wordIndex, isError }, index) => {
                      return (
                        <span
                          key={`${index}-${part}`}
                          className={`${
                            isWord && wordCount > 100 && wordIndex >= 100
                              ? "text-gray-400"
                              : "text-black"
                          } leading-10 ${isError ? "error-word" : ""}`}
                        >
                          {part}
                        </span>
                      );
                    },
                  )}
                </div>
                <textarea
                  ref={editorRef}
                  value={text}
                  onChange={(e) => updateText(e.target.value)}
                  onScroll={(e) => {
                    if (textOverlayRef.current) {
                      textOverlayRef.current.scrollTop =
                        e.currentTarget.scrollTop;
                      textOverlayRef.current.scrollLeft =
                        e.currentTarget.scrollLeft;
                    }
                  }}
                  aria-label="Enter your text"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  className="relative z-10 h-full w-full top-0 resize-none rounded-b border border-gray-300 p-4 text-left align-top text-transparent leading-10 caret-[#800000] selection:bg-gray-200 lg:text-2xl focus:border-[#800000] focus:outline-none focus:ring-0 transition duration-300"
                  style={{ lineHeight: "2.5rem" }}
                />
                {text === "" && (
                  <div className="pointer-events-none absolute left-4 top-6 text-gray-400 lg:text-2xl">
                    <TextType
                      text={["Enter your text.", "Paste your Taglish text."]}
                      typingSpeed={60}
                      pauseDuration={1500}
                      showCursor
                      cursorCharacter="_"
                      deletingSpeed={50}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="col-span-1 min-w-0 border-gray shadow-md transition duration-300 hover:shadow-xl focus:outline-none lg:col-span-1 lg:min-h-0 lg:overflow-y-auto">
              <div className="p-3 bg-[#800000]">
                <h2 className="text-white font-bold text-lg lg:text-2xl">
                  Suggestions
                </h2>
              </div>
              <div className="">
                <div className="col-span-1 p-4 rounded">
                  <Suggestions errors={errorWords} />
                </div>
              </div>
            </div>
          </div>
          <div
            className={`mt-1 text-base ${
              wordCount > 100 ? "text-red-600" : "text-slate-700"
            }`}
          >
            Words: <span className="font-semibold">{wordCount}/100</span>
          </div>
        </section>

        <section className="scroll-reveal flex min-h-[calc(100dvh-5rem)] flex-col py-4">
          <div className="grid flex-1 grid-cols-1 gap-4 lg:min-h-0 lg:grid-cols-4">
            <section className="col-span-1 flex min-h-128 flex-col border border-[#d8cfd1] bg-white shadow-sm transition-shadow hover:shadow-md lg:col-span-3 lg:min-h-0">
              <div className="flex items-center justify-between border-b border-[#e5dcdd] px-4 py-3">
                <h2 className="font-primary text-base font-bold text-[#3c3034] sm:text-lg">
                  Input Preview
                </h2>
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Unprocessed
                </span>
              </div>
              <pre
                aria-label="Unprocessed copy of input text"
                className="m-0 flex-1 overflow-auto whitespace-pre-wrap wrap-break-word bg-white p-4 font-primary text-sm leading-7 text-slate-800 sm:p-5 sm:text-base"
              >
                {text || (
                  <span className="font-sans text-slate-400">
                    Your text will appear here.
                  </span>
                )}
              </pre>
            </section>
            <CalamancyAnalysis
              tokens={analysis.tokens}
              status={analysis.status}
              error={analysis.error}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function CalamancyAnalysis({ tokens, status, error }) {
  return (
    <section className="col-span-1 flex min-h-128 flex-col border border-[#d8cfd1] bg-white shadow-sm transition-shadow hover:shadow-md lg:min-h-0">
      <div className="border-b border-[#e5dcdd] px-4 py-3">
        <h2 className="font-primary text-base font-bold text-[#3c3034] sm:text-lg">
          CalamanCy Analysis
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-white">
        <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
          <thead className="sticky top-0 bg-[#f6f2f2] text-[#3c3034]">
            <tr>
              <th className="w-[30%] border-b border-r border-[#ded5d6] p-2 sm:p-3">
                Word
              </th>
              <th className="w-[35%] border-b border-r border-[#ded5d6] p-2 sm:p-3">
                Part of Speech
              </th>
              <th className="w-[35%] border-b border-[#ded5d6] p-2 sm:p-3">
                Dependency
              </th>
            </tr>
          </thead>
          <tbody>
            {status === "ready" && tokens.length > 0 ? (
              tokens.map((token, index) => (
                <tr key={`${token.start}-${index}`}>
                  <td className="wrap-break-word border-b border-r border-[#eee8e8] p-2 sm:p-3">
                    {token.text}
                  </td>
                  <td className="wrap-break-word border-b border-r border-[#eee8e8] p-2 sm:p-3">
                    {token.pos}
                  </td>
                  <td className="wrap-break-word border-b border-[#eee8e8] p-2 sm:p-3">
                    {token.dependency}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="p-4 text-slate-500">
                  {status === "loading"
                    ? "Analyzing text..."
                    : status === "error"
                      ? `Could not reach the backend. (${error})`
                      : status === "ready"
                        ? "No tokens returned."
                        : "Token details will appear here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Brand({ light = false }) {
  return (
    <img
      src={Logo}
      alt="CA Spell logo"
      className={
        light
          ? "h-12 w-auto max-w-[220px] object-contain sm:h-14"
          : "h-12 w-auto max-w-[220px] object-contain drop-shadow-[0_2px_6px_rgba(56,36,95,0.08)] sm:h-14"
      }
    />
  );
}

function LandingPage({ onLogin }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(125deg,#f8f3ef_0%,#eee4e4_56%,#e2e3ed_100%)] text-[#241e28]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-10">
        <Brand />

        <button
          type="button"
          onClick={onLogin}
          className="border-b-2 border-[#8c1d35] px-1 py-2 font-semibold text-[#54151a] transition-colors hover:text-[#8c1d35]"
        >
          Log in <span aria-hidden="true">→</span>
        </button>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl items-center gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-24">
        <div className="page-enter max-w-2xl">
          <p className="mb-5 font-primary text-sm font-bold uppercase tracking-[0.18em] text-[#8c1d35]">
            Taglish spelling checker
          </p>
          <h1 className="font-display text-7xl font-extrabold uppercase leading-[0.88] text-[#3b2446] sm:text-8xl lg:text-8xl">
            Write it
            <br />
            the right way.
          </h1>
          <p className="mt-7 max-w-xl font-primary text-lg leading-relaxed text-[#423c43] sm:text-xl">
            Clearer Taglish, without losing your voice. Ca-Spell checks
            code-switched Filipino and English so you can focus on what you want
            to say.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex min-h-14 items-center gap-5 bg-[#74191d] px-7 font-primary font-bold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-[#5b1116] hover:shadow-xl"
            >
              Get started <span aria-hidden="true">→</span>
            </button>
            <a
              href="#about-ca-spell"
              className="font-primary font-semibold text-[#3b2446] underline decoration-[#b99ca2] underline-offset-4 hover:text-[#8c1d35] "
            >
              About Ca-Spell
            </a>
          </div>
        </div>

        <div className="page-enter relative mx-auto w-full max-w-xl lg:justify-self-end">
          <div className="absolute -right-8 -top-8 h-28 w-28 border-r-2 border-t-2 border-[#a88891]/60" />
          <div className="relative border border-[#c9b8bb] bg-[#fbfaf9]/90 p-5 shadow-[16px_18px_0_rgba(92,45,53,0.10)] sm:p-7">
            <div className="mb-5 flex items-center justify-between border-b border-[#ded5d4] pb-4">
              <p className="font-primary text-sm font-bold uppercase tracking-[0.14em] text-[#4a3b42]">
                Text check
              </p>
              <span className="inline-flex items-center gap-2 font-primary text-xs font-semibold text-[#536849]">
                <span className="h-2 w-2 rounded-full bg-[#668558]" />
                Ready
              </span>
            </div>
            <p className="min-h-36 font-primary text-lg leading-9 text-[#28232a] sm:text-xl">
              <span className="underline decoration-2 decoration-[#b32835] underline-offset-4">
                Nag submit
              </span>{" "}
              kami bagong assignment sa aming guro.
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-[#ded5d4] pt-4 font-primary text-sm">
              <span className="font-medium text-[#696068]">1 suggestion</span>
              <span className="font-bold text-[#74191d]">Review text →</span>
            </div>
          </div>
          <div className="absolute -bottom-7 -left-7 hidden h-16 w-16 border-b-2 border-l-2 border-[#38245f]/40 sm:block" />
        </div>
      </section>

      <section
        id="about-ca-spell"
        className="scroll-mt-8 border-t border-[#d8c9cb] bg-[#fbfaf8]/75 px-5 py-14 lg:px-10 lg:py-20"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 border-b border-[#d8c9cb] pb-8 md:grid-cols-[0.8fr_1.8fr] md:gap-12">
            <div>
              <p className="font-primary text-sm font-bold uppercase tracking-[0.16em] text-[#74191d]">
                About Ca-Spell
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold uppercase leading-tight text-[#3b2446] sm:text-5xl">
                Clearer writing for Taglish thinkers.
              </h2>
            </div>
            <p className="max-w-3xl font-primary text-base leading-8 text-[#4e474d] md:pt-7 lg:text-lg">
              Ca-Spell is an automated spelling checker designed for
              code-switched Tagalog-English text. It helps writers spot spelling
              errors while keeping their natural voice intact.
            </p>
          </div>

          <div className="grid gap-10 py-9 md:grid-cols-[1.4fr_1fr] md:gap-16">
            <div>
              <p className="font-primary text-sm font-bold uppercase tracking-[0.12em] text-[#74191d]">
                Why we built it
              </p>
              <h3 className="mt-2 max-w-2xl font-primary text-2xl font-bold leading-snug text-[#2e2930] sm:text-3xl">
                Language should not get in the way of your ideas.
              </h3>
              <p className="mt-4 max-w-2xl font-primary leading-relaxed text-[#5a5359]">
                Taglish is part of everyday communication, but many writing
                tools are built around English-only rules. Ca-Spell is shaped
                around the way Taglish is actually written, making proofreading
                more useful, approachable, and relevant.
              </p>
            </div>
            <div>
              <p className="font-primary text-sm font-bold uppercase tracking-[0.12em] text-[#74191d]">
                Built around
              </p>
              <ul className="mt-4 space-y-3 font-primary text-[#4e474d]">
                <li className="border-l-4 border-[#8c1d35] py-1 pl-4">
                  Taglish writing
                </li>
                <li className="border-l-4 border-[#bd8d46] py-1 pl-4">
                  Readable feedback
                </li>
                <li className="border-l-4 border-[#668558] py-1 pl-4">
                  Focused editing
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoginPage({ onContinue, onBack, onCreateAccount }) {
  const [notice, setNotice] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onContinue();
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-[linear-gradient(125deg,#f8f3ef_0%,#eee4e4_56%,#e2e3ed_100%)] px-4 py-12 text-[#171417] sm:py-16">
      <button
        type="button"
        onClick={onBack}
        className="page-enter mb-2 flex flex-col items-center text-center"
        aria-label="Back to landing page"
      >
        <div className="flex flex-col items-center">
          <Brand />
          <h2 className="mt-2 font-primary text-base font-medium italic text-[#4b4145] sm:text-lg">
            For Every Taglish Error, May Koreksyon
          </h2>
        </div>
      </button>

      <section className="page-enter w-full max-w-117 border border-[#bdb8c9] bg-[#fbfbfb] px-7 py-6 shadow-[0_14px_20px_rgba(38,28,35,0.22)] sm:px-12 sm:py-7">
        <h1 className="mb-5 text-center font-primary text-xl font-bold sm:text-2xl">
          Welcome to <span className="text-[#38245f]">Ca-</span>
          <span className="text-[#8c1d35]">Spell!</span>
        </h1>
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="login-email"
            className="mb-1.5 block font-primary text-sm font-medium text-slate-700"
          >
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className="mb-3 h-14 w-full rounded-md border border-slate-300 bg-white px-3.5 font-primary text-sm font-normal text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#74191d] focus:ring-2 focus:ring-[#74191d]/15"
          />
          <label
            htmlFor="login-password"
            className="mb-1.5 block font-primary text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="mb-7 h-14 w-full rounded-md border border-slate-300 bg-white px-3.5 font-primary text-sm font-normal text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#74191d] focus:ring-2 focus:ring-[#74191d]/15"
          />
          <button
            type="submit"
            className="h-11 w-full bg-[#74191d] px-4 font-primary text-sm font-semibold text-white transition-colors hover:bg-[#5b1116] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74191d]"
          >
            Log in
          </button>
        </form>
        {/* <button
          type="button"
          onClick={() => setNotice("Password recovery is not available yet.")}
          className="mx-auto mt-3 block px-2 py-1 text-center font-primary text-sm font-medium text-[#74191d] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74191d]"
        >
          Forgot password?
        </button> */}
        {/* <div className="mx-3 my-3 border-t border-[#aaa5a5]" /> */}
        <button
          type="button"
          onClick={onCreateAccount}
          className="h-11 w-full border border-[#74191d] bg-transparent px-4 mt-2 font-primary text-sm font-semibold text-[#74191d] transition-colors hover:bg-[#f4e9e9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74191d]"
        >
          Create account
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="mt-2 h-10 w-full px-4 font-primary text-sm font-medium text-[#74191d] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74191d]"
        >
          Continue as guest
        </button>
        {notice && (
          <p
            role="status"
            className="mt-3 text-center font-primary text-sm text-[#74191d]"
          >
            {notice}
          </p>
        )}
      </section>
    </main>
  );
}

function CreateAccountPage({ onBack, onBackToLogin }) {
  const [notice, setNotice] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (formData.get("password") !== formData.get("confirm-password")) {
      setNotice("The passwords do not match.");
      return;
    }
    setNotice(
      "Account registration is not connected yet. No account was saved.",
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-[linear-gradient(125deg,#f8f3ef_0%,#eee4e4_56%,#e2e3ed_100%)] px-4 py-10 text-[#171417] sm:py-14">
      <button
        type="button"
        onClick={onBack}
        className="page-enter mb-5 flex flex-col items-center text-center"
        aria-label="Back to login"
      >
        <div className="flex flex-col items-center">
          <Brand />
          <h2 className="mt-2 font-primary text-base font-medium italic text-[#4b4145] sm:text-lg">
            For Every Taglish Error, May Koreksyon
          </h2>
        </div>
      </button>

      <section className="page-enter w-full max-w-117 border border-[#bdb8c9] bg-[#fbfbfb] px-7 py-6 shadow-[0_14px_20px_rgba(38,28,35,0.22)] sm:px-12 sm:py-8">
        <h1 className="mb-6 text-center font-primary text-xl font-bold sm:text-2xl">
          Create your Ca-Spell account
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <RegistrationField
            id="register-name"
            name="name"
            label="Name"
            type="text"
            autoComplete="name"
          />
          <RegistrationField
            id="register-email"
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
          />
          <RegistrationField
            id="register-password"
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            minLength={8}
          />
          <RegistrationField
            id="register-confirm-password"
            name="confirm-password"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            minLength={8}
          />
          <button
            type="submit"
            className="h-11 w-full bg-[#74191d] px-4 font-primary text-sm font-semibold text-white transition-colors hover:bg-[#5b1116] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74191d]"
          >
            Create account
          </button>
        </form>
        {notice && (
          <p
            role="status"
            className="mt-4 text-center font-primary text-sm text-[#74191d]"
          >
            {notice}
          </p>
        )}
        <p className="mt-5 text-center font-primary text-sm text-slate-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onBackToLogin}
            className="font-semibold text-[#74191d] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#74191d]"
          >
            Log in
          </button>
        </p>
      </section>
    </main>
  );
}

function RegistrationField({ id, name, label, type, autoComplete, minLength }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block font-primary text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3.5 font-primary text-sm font-normal text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#74191d] focus:ring-2 focus:ring-[#74191d]/15"
      />
    </div>
  );
}

export default App;
