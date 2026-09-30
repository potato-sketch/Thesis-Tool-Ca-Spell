import { useEffect, useRef, useState } from "react";
import Suggestions from "./Suggestions";
import TextType from "./TextType";
import DecryptedText from "./DecryptedText";
import { findNonEnglishWords, isNonEnglishWord } from "./nonEnglishWords";
import Delete from "./assets/delete.png";
import Copy from "./assets/copy.png";

function App() {
  const [text, setText] = useState("");
  const textOverlayRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const [isOpen, setIsOpen] = useState(false);
  const [activePage, setActivePage] = useState("home");

  const textParts =
    text.match(/\s+|[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*|[^\s\p{L}\p{M}]+/gu) ??
    [];
  const nonEnglishWords = findNonEnglishWords(text);
  let renderedWordCount = 0;

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
  }, [activePage]);

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
    setText("");
  }
  return (
    <div>
      <nav className="bg-linear-to-r from-[#f6f0ed] via-[#eadfe3] to-[#dfe0eb] px-4 py-4 shadow-sm lg:px-10 lg:py-3">
        <div className="flex items-center justify-between">
          <div className="font-display text-4xl font-extrabold uppercase leading-none tracking-[-0.04em] lg:text-6xl">
            <span className="text-[#38245f]">
              <DecryptedText text="CA-" speed={75} maxIterations={20} />
            </span>
            <span className="text-[#8c1d35]">
              <DecryptedText text="SPELL" speed={75} maxIterations={20} />
            </span>
          </div>
          <ul className="hidden items-center gap-7 font-primary text-base font-medium text-[#252545] md:flex lg:gap-4 lg:text-xl">
            <li>
              <button
                type="button"
                onClick={() => setActivePage("home")}
                className={`border-b-2 border-transparent px-4 py-1 transition-colors duration-200 hover:border-[#252545] ${
                  activePage === "home" ? "border-[#252545]" : ""
                }`}
              >
                Home
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActivePage("about")}
                className={`border-b-2 border-transparent px-4 py-1 transition-colors duration-200 hover:border-[#252545] ${
                  activePage === "about" ? "border-[#252545]" : ""
                }`}
              >
                About
              </button>
            </li>
          </ul>

          <div className="md:hidden">
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
          </div>

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
                  setActivePage("home");
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
                  setActivePage("about");
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

      {activePage === "about" ? (
        <AboutPage onBackHome={() => setActivePage("home")} />
      ) : (
        <div className="page-enter px-4">
          <div className="scroll-reveal py-3">
            <h2 className="font-primary italic text-2xl font-bold">
              For every Taglish Error, May Ca-Spell Ka!
            </h2>
            <h3 className="font-secondary text-sm lg:text-xl">
              Ca-Spell is an automated spelling checker, specifically for
              code-switched Tagalog-English (Taglish) texts. Type or paste your
              text here to check for spelling errors.
            </h3>
          </div>
          <div className="scroll-reveal grid grid-cols-1 gap-4 lg:grid-cols-4 h-130">
            <div className="col-span-1 flex flex-col shadow-md border-gray lg:col-span-3 hover:shadow-xl focus:outline-none transition duration-300">
              <div className="flex flex-row p-3 bg-[#800000] justify-between text-white">
                <h2 className="font-bold text-lg lg:text-2xl">Original Text</h2>
                <div className="flex flex-row gap-5">
                  <button
                    onClick={handleClear}
                    className=" flex flex-row items-center gap-3 bordertext-lg text-black  lg:px-4 lg:text-xl px-2 bg-white rounded-xl transition-all duration-300 ease-out
        hover:bg-white hover:text-red-600 hover:scale-105 hover:shadow-xl
        active:scale-95"
                  >
                    <img src={Delete} alt="" className=" h-5 w-5 gap-2" />
                    <span className="hidden md:flex ">Clear</span>
                  </button>
                  <button
                    className="flex flex-row items-center gap-3 bordertext-lg lg:text-xl lg:px-4  px-2 bg-white rounded-xl text-black transition-all duration-300 ease-out
        hover:bg-white hover:text-green-600 hover:scale-105 hover:shadow-xl active:scale-95 "
                  >
                    <img src={Copy} alt="" className="h-5 w-5" />
                    <span className="hidden md:flex ">Copy</span>
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
                  {textParts.map((part, index) => {
                    const isWord = /[\p{L}\p{M}]/u.test(part);
                    const wordIndex = renderedWordCount;
                    if (isWord) renderedWordCount += 1;
                    const isNonEnglish = isWord && isNonEnglishWord(part);

                    return (
                      <span
                        key={`${index}-${part}`}
                        className={`${
                          isWord && wordCount > 100 && wordIndex >= 100
                            ? "text-gray-400"
                            : "text-black"
                        } leading-10 ${isNonEnglish ? "non-english-word" : ""}`}
                      >
                        {part}
                      </span>
                    );
                  })}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onScroll={(e) => {
                    if (textOverlayRef.current) {
                      textOverlayRef.current.scrollTop =
                        e.currentTarget.scrollTop;
                      textOverlayRef.current.scrollLeft =
                        e.currentTarget.scrollLeft;
                    }
                  }}
                  aria-label="Enter your text"
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
            <div className="col-span-1 shadow-md border-gray hover:shadow-xl focus:outline-none  transition duration-300">
              <div className="p-3 bg-[#800000]">
                <h2 className="text-white font-bold text-lg lg:text-2xl">
                  Suggestions
                </h2>
              </div>
              <div className="">
                <div className="col-span-1 p-4 rounded">
                  <Suggestions nonEnglishWords={nonEnglishWords} />
                </div>
              </div>
            </div>
          </div>
          <div className="scroll-reveal">
            <h1
              className={`mt-2 text-lg lg:text-2xl ${
                wordCount > 100 ? "text-red-600" : ""
              }`}
            >
              Words: <span className="font-bold">{wordCount}/100</span>
            </h1>
          </div>
        </div>
      )}
    </div>
  );
}

function AboutPage({ onBackHome }) {
  return (
    <main className="page-enter min-h-[calc(100vh-80px)] bg-slate-50 px-4 py-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <section className="scroll-reveal rounded-2xl bg-[#800000] px-6 py-10 text-white shadow-xl lg:px-12 lg:py-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-red-200">
            About Ca-Spell
          </p>
          <h1 className="max-w-3xl font-primary text-4xl font-bold leading-tight lg:text-6xl">
            Clearer writing for Taglish thinkers.
          </h1>
          <p className="mt-5 max-w-2xl font-secondary text-lg leading-relaxed text-red-50 lg:text-xl">
            Ca-Spell is an automated spelling checker designed for code-switched
            Tagalog-English text. It helps writers spot spelling errors while
            keeping their natural voice intact.
          </p>
        </section>

        <section className="scroll-reveal mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#800000]">
              Why we built it
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-800 lg:text-3xl">
              Language should not get in the way of your ideas.
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              Taglish is part of everyday communication, but many writing tools
              are built around English-only rules. Ca-Spell is shaped around the
              way Taglish is actually written, making proofreading more useful,
              approachable, and relevant.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#800000]">
              Built around
            </p>
            <ul className="mt-4 space-y-3 text-slate-700">
              <li className="border-l-4 border-red-700 pl-3">
                Taglish writing
              </li>
              <li className="border-l-4 border-amber-500 pl-3">
                Readable feedback
              </li>
              <li className="border-l-4 border-emerald-600 pl-3">
                Focused editing
              </li>
            </ul>
          </div>
        </section>

        <button
          type="button"
          onClick={onBackHome}
          className="scroll-reveal mt-8 inline-flex items-center gap-3 rounded-lg bg-[#800000] px-5 py-3 font-semibold text-white transition hover:bg-[#650000]"
        >
          <span aria-hidden="true">←</span>
          Back to editor
        </button>
      </div>
    </main>
  );
}

export default App;
