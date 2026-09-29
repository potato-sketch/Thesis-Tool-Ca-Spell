import { useState } from "react";

const suggestions = [
  { error: "recieve", suggestion: "receive", confidence: "98%" },
  { error: "definately", suggestion: "definitely", confidence: "97%" },
  { error: "seperate", suggestion: "separate", confidence: "96%" },
  { error: "alot", suggestion: "a lot", confidence: "95%" },
  { error: "occured", suggestion: "occurred", confidence: "94%" },
];

export default function Suggestions({
  errors = [],
  tokens = [],
  analysisStatus = "idle",
  analysisError = "",
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Spelling review
            </p>
            <h3 className="text-lg font-bold text-slate-800 lg:text-xl">
              Suggested corrections
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-slate-600 transition hover:border-[#800000] hover:bg-red-50 hover:text-[#800000]"
            aria-expanded={isDropdownOpen}
            aria-label="Toggle suggestions list"
          >
            <svg
              className={`h-5 w-5 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        <section className="mb-4 rounded-md border border-violet-100 bg-violet-50 p-3">
          <h4 className="font-semibold text-violet-950">CalamanCy analysis</h4>
          {analysisStatus === "idle" && (
            <p className="mt-1 text-sm text-slate-600">Enter text to analyze its Tagalog tokens.</p>
          )}
          {analysisStatus === "loading" && (
            <p className="mt-1 text-sm text-slate-600">Analyzing…</p>
          )}
          {analysisStatus === "error" && (
            <p className="mt-1 text-sm text-red-700">
              Could not reach the backend. Make sure it is running. ({analysisError})
            </p>
          )}
          {analysisStatus === "ready" && (
            tokens.length ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {tokens.map((token, index) => (
                  <li key={`${token.start}-${index}`} className="flex flex-wrap gap-x-2">
                    <span className="font-medium text-slate-900">{token.text}</span>
                    <span className="text-violet-800">{token.pos}</span>
                    <span className="text-slate-500">{token.dependency}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-slate-600">No tokens returned.</p>
            )
          )}
        </section>

        {[...new Set(errors.map((error) => error.text))].map((word) => (
          <div
            key={word}
            className="mb-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <span className="min-w-0 break-words font-medium text-red-700">
              {word}
            </span>
            <svg
              className="h-6 w-8 shrink-0 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
            <span className="shrink-0 text-slate-500">No suggestion</span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="group w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-[#800000] hover:bg-red-50"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-red-700">
              {suggestions[0].error}
            </span>
            <svg
              className="h-7 w-12 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#800000]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
            <span className="font-medium text-emerald-700">
              {suggestions[0].suggestion}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Click to view top 5 suggestions
          </p>
        </button>

        {isDropdownOpen && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {suggestions.slice(1).map((item) => (
              <div
                key={item.error}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-red-700">{item.error}</span>
                <span className="text-slate-400">to</span>
                <span className="text-emerald-700">{item.suggestion}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestions-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#800000]">
                  Ranked results
                </p>
                <h2
                  id="suggestions-title"
                  className="text-2xl font-bold text-slate-800"
                >
                  Top suggestions
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close suggestions"
              >
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {suggestions.map((item, index) => (
                <div
                  key={item.error}
                  className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3"
                >
                  <span className="text-sm font-bold text-slate-400">
                    {index + 1}
                  </span>
                  <div className="relative flex min-w-0 items-center">
                    <span className="w-1/2 pr-8 text-left font-semibold text-red-700">
                      {item.error}
                    </span>
                    <svg
                      className="absolute left-1/2 h-6 w-10 -translate-x-1/2 text-slate-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                    <span className="w-1/2 pl-8 text-right font-semibold text-emerald-700">
                      {item.suggestion}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {item.confidence}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
