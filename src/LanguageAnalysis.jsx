import { useEffect, useState } from "react";
import AnalysisWalkthrough from "./AnalysisWalkthrough";
import {
  describeLanguages,
  describePartOfSpeech,
  describeRelationship,
} from "./analysisLabels";

function Section({ title, children }) {
  return (
    <section className="mb-5 rounded-lg border border-[#d8cfd1] bg-white p-4">
      <h3 className="mb-2 text-lg font-bold text-[#3c3034]">{title}</h3>
      {children}
    </section>
  );
}

export default function LanguageAnalysis({
  tokens,
  errors = [],
  weights,
  status,
  error,
  onClose,
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const visibleTokens = tokens.filter((token) => token.text.trim() !== "");
  const walkthroughKey = visibleTokens.map((token) => token.text).join("|");

  let body;
  if (status === "loading" || status === "idle") {
    body = (
      <p className="text-slate-600">
        {status === "loading"
          ? "Analyzing your text..."
          : "Enter some text to see how its words are analyzed."}
      </p>
    );
  } else if (status === "error") {
    body = (
      <p className="text-red-700">
        The analysis service could not be reached. Make sure the backend is
        running, then try again. ({error})
      </p>
    );
  } else if (visibleTokens.length === 0) {
    body = <p className="text-slate-600">No words were returned.</p>;
  } else {
    body = (
      <>
        <Section title="What this analysis shows">
          <p className="text-sm leading-relaxed text-slate-700">
            Ca-Spell reads your text the way a language teacher would. It
            splits the text into individual words, decides what kind of word
            each one is, and works out how the words connect to each other.
            Ca-Spell uses this to find mistakes that a plain dictionary check
            would miss, such as a correctly spelled word used in the wrong
            place.
          </p>
        </Section>

        <AnalysisWalkthrough
          key={walkthroughKey}
          tokens={visibleTokens}
          errors={errors}
          weights={weights}
        />

        <div className="mb-5">
          <button
            type="button"
            onClick={() => setShowBreakdown(!showBreakdown)}
            aria-expanded={showBreakdown}
            className="group relative inline-flex items-center gap-2 rounded-md border border-[#d8cfd1] bg-white px-4 py-2 text-sm font-semibold text-[#3c3034] shadow-sm transition hover:border-[#800000] hover:text-[#800000]"
          >
            <span
              aria-hidden="true"
              className="grid h-5 w-5 place-items-center rounded-full border border-current text-xs font-bold italic"
            >
              i
            </span>
            {showBreakdown ? "Hide word breakdown" : "View word breakdown"}
            <span
              role="tooltip"
              className={`pointer-events-none absolute left-0 top-full z-10 mt-2 w-72 rounded-md bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition ${
                showBreakdown
                  ? ""
                  : "group-hover:opacity-100 group-focus-visible:opacity-100"
              }`}
            >
              See each word's language, part of speech, and the word it is
              connected to.
            </span>
          </button>
        </div>

        {showBreakdown && (
          <Section title="Word breakdown">
          <p className="mb-3 text-sm leading-relaxed text-slate-700">
            <strong>Part of speech</strong> is the job a word does in a
            sentence, such as naming a thing (noun) or describing an action
            (verb). <strong>Relationship</strong> is how the word connects to
            another word in the same sentence.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-[#f6f2f2] text-[#3c3034]">
                <tr>
                  <th className="border-b border-[#ded5d6] p-2">Word</th>
                  <th className="border-b border-[#ded5d6] p-2">Language</th>
                  <th className="border-b border-[#ded5d6] p-2">
                    Part of speech
                  </th>
                  <th className="border-b border-[#ded5d6] p-2">
                    Relationship
                  </th>
                  <th className="border-b border-[#ded5d6] p-2">
                    Connected to
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleTokens.map((token) => {
                  const [posLabel, posHint] = describePartOfSpeech(token.pos);
                  const [relationLabel, relationHint] = describeRelationship(
                    token.dependency,
                  );
                  const isMainWord = token.head_index === token.index;
                  return (
                    <tr key={token.index} className="align-top">
                      <td className="border-b border-[#eee8e8] p-2 font-semibold">
                        {token.text}
                      </td>
                      <td className="border-b border-[#eee8e8] p-2">
                        {describeLanguages(token.languages)}
                      </td>
                      <td className="border-b border-[#eee8e8] p-2">
                        <div>{posLabel}</div>
                        <div className="text-xs text-slate-500">{posHint}</div>
                      </td>
                      <td className="border-b border-[#eee8e8] p-2">
                        <div>{relationLabel}</div>
                        <div className="text-xs text-slate-500">
                          {relationHint}
                        </div>
                      </td>
                      <td className="border-b border-[#eee8e8] p-2">
                        {isMainWord ? "Nothing (top of the sentence)" : token.head}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </Section>
        )}
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/50 px-3 pb-4 pt-4 sm:px-6 sm:pt-8"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2.5rem)] w-full max-w-[960px] overflow-y-auto rounded-xl bg-[#f5f4f4] p-4 shadow-[0_16px_35px_rgba(0,0,0,0.22)] sm:max-h-[calc(100vh-3rem)] sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-analysis-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#800000]">
              Sentence analysis
            </p>
            <h2
              id="language-analysis-title"
              className="mt-1 text-2xl font-bold text-[#800000]"
            >
              How Ca-Spell understands your text
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close analysis"
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
        {body}
      </div>
    </div>
  );
}
