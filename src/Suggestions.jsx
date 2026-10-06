import { useEffect, useState } from "react";

const suggestions = [
  { error: "assignmnt", suggestion: "assignment", confidence: 0.98 },
  { error: "assignmnt", suggestion: "assignments", confidence: 0.85 },
  { error: "assignmnt", suggestion: "assault", confidence: 0.42 },
  { error: "assignmnt", suggestion: "assignment", confidence: 0.67 },
  { error: "assignmnt", suggestion: "assignment", confidence: 0.51 },
];

export default function Suggestions({ errors = [] }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;

      if (nearBottom) {
        setIsModalOpen(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isModalOpen]);

  const reviewItems = suggestions.map((item, index) => ({
    ...item,
    id: index + 1,
    scoreLabel: `Score: ${item.confidence.toFixed(2)}`,
  }));

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

        {[...new Set(errors.map((error) => error.text))].map((word) => (
          <div
            key={word}
            className="mb-2 flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
          >
            <span className="min-w-0 wrap-break-word font-medium text-red-700">
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
            {suggestions.map((item) => (
              <button
                key={item.error}
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-sm transition hover:bg-slate-50"
              >
                <span className="text-red-700">{item.error}</span>
                <span className="text-slate-400">to</span>
                <span className="text-emerald-700">{item.suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 pb-4 pt-4 sm:px-6 sm:pt-8"
          role="presentation"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="max-h-[calc(100vh-2.5rem)] w-full max-w-[760px] overflow-y-auto rounded-xl bg-[#f5f4f4] p-4 shadow-[0_16px_35px_rgba(0,0,0,0.22)] sm:max-h-[calc(100vh-3rem)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="suggestions-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800000]">
                  Correction Review
                </p>
                <h2
                  id="suggestions-title"
                  className="mt-1 text-xl font-bold text-[#800000]"
                >
                  Error 1 of 3
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

            <div className="mb-3 rounded-md border border-[#d5d5d5] bg-[#f0f0f0] p-3">
              <p className="text-[14px] text-[#4c4c4c]">
                Context: <span className="italic">...ang </span>
                <span className="font-medium text-[#a73030] underline decoration-[#a73030] decoration-2 underline-offset-4">
                  assignmnt
                </span>
                <span className="italic"> na ipinas...</span>
              </p>
            </div>

            <div className="mb-3">
              <p className="text-[15px] font-bold text-[#a73030]">
                Flagged Token: <span className="font-bold">assignmnt</span>
              </p>
            </div>

            <div className="space-y-2.5">
              {reviewItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                    item.id === 1
                      ? "border-[#e8d169] bg-[#f7f1c5]"
                      : "border-[#d7d7d7] bg-[#f5f5f5]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="min-w-[1.5rem] text-sm font-bold text-[#2d2d2d]">
                      {item.id}
                    </span>
                    <span className="text-[16px] font-medium text-[#3a7a43]">
                      {item.suggestion}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex min-w-[70px] items-center justify-center rounded-full bg-[#dfe0e2] px-2.5 py-1 text-xs font-medium text-[#444]">
                      {item.scoreLabel}
                    </span>
                    <button
                      type="button"
                      className="rounded-md bg-[#d8d8d8] px-3 py-1.5 text-xs font-semibold text-[#2f2f2f] transition hover:bg-[#cfcfcf]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-md bg-[#e8e7e7] px-5 py-2.5 text-sm font-semibold text-[#3b3b3b] shadow-sm transition hover:bg-[#ddd]"
              >
                Previous Error
              </button>
              <button
                type="button"
                className="rounded-md bg-[#2a2a2a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d1d1d]"
              >
                Next Error
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
