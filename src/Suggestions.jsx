import { useEffect, useState } from "react";

const reasonLabels = {
  spelling: "Misspelled word",
  hyphenation: "Hyphen placed incorrectly",
  context: "Verb tense and time word do not agree",
};

function formatScore(value) {
  return (value ?? 0).toFixed(2);
}

export default function Suggestions({ text = "", errors = [], onApply }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const isModalOpen = activeIndex !== null && errors.length > 0;
  const current = isModalOpen
    ? Math.min(activeIndex, errors.length - 1)
    : 0;
  const active = isModalOpen ? errors[current] : null;

  useEffect(() => {
    if (!isModalOpen) return;

    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;

      if (nearBottom) {
        setActiveIndex(null);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isModalOpen]);

  const arrow = (
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
  );

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Spelling review
          </p>
          <h3 className="text-lg font-bold text-slate-800 lg:text-xl">
            Suggested corrections
          </h3>
        </div>

        {errors.length === 0 && (
          <p className="text-sm text-slate-500">
            No errors found. Corrections will appear here as you type.
          </p>
        )}

        <div className="space-y-2">
          {errors.map((error, index) => {
            const top = error.suggestions?.[0];
            return (
              <button
                key={`${error.start}-${error.text}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-[#800000] hover:bg-red-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 wrap-break-word font-medium text-red-700">
                    {error.text}
                  </span>
                  {arrow}
                  <span
                    className={`min-w-0 wrap-break-word font-medium ${
                      top ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {top ? top.word : "No suggestion"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {top
                    ? `Click to view ${error.suggestions.length} suggestion${
                        error.suggestions.length === 1 ? "" : "s"
                      }`
                    : "Click for details"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 pb-4 pt-4 sm:px-6 sm:pt-8"
          role="presentation"
          onClick={() => setActiveIndex(null)}
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
                  Error {current + 1} of {errors.length}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(null)}
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
                Context:{" "}
                <span className="italic">
                  {active.start > 20 ? "..." : ""}
                  {text.slice(Math.max(0, active.start - 20), active.start)}
                </span>
                <span className="font-medium text-[#a73030] underline decoration-[#a73030] decoration-2 underline-offset-4">
                  {active.text}
                </span>
                <span className="italic">
                  {text.slice(active.end, active.end + 20)}
                  {active.end + 20 < text.length ? "..." : ""}
                </span>
              </p>
            </div>

            <div className="mb-3">
              <p className="text-[15px] font-bold text-[#a73030]">
                Flagged Word: <span className="font-bold">{active.text}</span>
              </p>
              <p className="text-sm text-slate-600">
                {(active.reasons ?? [])
                  .map((reason) => reasonLabels[reason] ?? reason)
                  .join(", ")}
              </p>
            </div>

            <div className="space-y-2.5">
              {(active.suggestions ?? []).length === 0 && (
                <p className="rounded-lg border border-[#d7d7d7] bg-[#f5f5f5] px-3 py-2.5 text-sm text-slate-600">
                  No replacement words are available for this error.
                </p>
              )}
              {(active.suggestions ?? []).map((item, index) => (
                <div
                  key={item.word}
                  className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                    index === 0
                      ? "border-[#e8d169] bg-[#f7f1c5]"
                      : "border-[#d7d7d7] bg-[#f5f5f5]"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="min-w-[1.5rem] text-sm font-bold text-[#2d2d2d]">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[16px] font-medium text-[#3a7a43]">
                        {item.word}
                      </span>
                      <p className="text-xs text-slate-500">
                        Spelling similarity{" "}
                        {formatScore(item.scores?.edit_distance)} · Sentence fit{" "}
                        {formatScore(item.scores?.dependency_compatibility)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex min-w-[70px] items-center justify-center rounded-full bg-[#dfe0e2] px-2.5 py-1 text-xs font-medium text-[#444]">
                      Score: {formatScore(item.score)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onApply?.(active, item.word)}
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
                onClick={() => setActiveIndex(current - 1)}
                disabled={current === 0}
                className="rounded-md bg-[#e8e7e7] px-5 py-2.5 text-sm font-semibold text-[#3b3b3b] shadow-sm transition hover:bg-[#ddd] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous Error
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex(current + 1)}
                disabled={current === errors.length - 1}
                className="rounded-md bg-[#2a2a2a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d1d1d] disabled:cursor-not-allowed disabled:opacity-40"
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
