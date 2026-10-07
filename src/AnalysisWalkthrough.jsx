import { useEffect, useMemo, useState } from "react";
import CorrectionStage from "./CorrectionStages";
import SentenceTree from "./SentenceTree";
import {
  describePartOfSpeech,
  hasGapBefore,
  partOfSpeechColor,
  reasonLabels,
} from "./analysisLabels";

const correctionStepKeys = new Set([
  "similar",
  "place",
  "neighborhood",
  "mixing",
  "fit",
  "rank",
]);

function buildSteps(hasCorrections) {
  const steps = [
    {
      key: "read",
      title: "Read your text",
      seconds: 3.5,
      description: "Ca-Spell starts with the exact text you typed.",
    },
    {
      key: "split",
      title: "Split it into words",
      seconds: 4.5,
      description:
        "The text is split into separate words and punctuation marks. Hyphenated Taglish words such as 'nag-submit' stay together as one word.",
    },
    {
      key: "roles",
      title: "Identify each word's role",
      seconds: 5,
      description:
        "Each word is labeled with its part of speech, which is the job the word does in a sentence. Colors group similar kinds of words.",
    },
    {
      key: "connect",
      title: "Connect related words",
      seconds: 6.5,
      description:
        "Next, Ca-Spell works out how the words depend on each other. The main word is at the top, and every other word hangs from the word it relates to.",
    },
    {
      key: "check",
      title: "Check every word",
      seconds: 5.5,
      description:
        "Each word is checked twice: is it spelled correctly in English or Tagalog, and does it make sense with the words around it, such as a past-tense verb used with a future time word?",
    },
  ];
  if (hasCorrections) {
    steps.push(
      {
        key: "similar",
        title: "Find similar words",
        seconds: 8,
        description:
          "For each flagged word, Ca-Spell collects real words that are spelled almost the same, and scores how close each one is.",
      },
      {
        key: "place",
        title: "Try each word in your sentence",
        seconds: 6,
        description:
          "Spelling alone cannot tell which candidate is right, so each one is placed in your sentence and the sentence is analyzed again.",
      },
      {
        key: "neighborhood",
        title: "Check how each word fits its neighbors",
        seconds: 10,
        description:
          "Part one of the Taglish-Aware Weighted Dependency Compatibility Algorithm: does the candidate play a sensible role among the words around it?",
      },
      {
        key: "mixing",
        title: "Check English and Tagalog mixing",
        seconds: 8,
        description:
          "Part two: when the candidate is connected to a word in the other language, is that pairing one that works in Taglish?",
      },
      {
        key: "fit",
        title: "Combine into the sentence fit score",
        seconds: 7,
        description:
          "Part three: the two results are weighted and added together into one score for how well the candidate fits the sentence.",
      },
      {
        key: "rank",
        title: "Combine with spelling and rank",
        seconds: 8,
        description:
          "Spelling similarity and sentence fit are weighted and added into the final score. The candidates are sorted from highest to lowest.",
      },
      {
        key: "apply",
        title: "Use the best correction",
        seconds: 6,
        description:
          "The best-scoring word replaces the flagged word. Choose Apply in the Suggested corrections panel to make this change in your text.",
      },
    );
  }
  return steps;
}

function Chip({ children, className = "", delay = 0 }) {
  return (
    <span
      className={`walk-pop inline-block rounded-lg border px-3 py-1.5 text-base font-semibold ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </span>
  );
}

function Stage({ step, tokens, errors }) {
  const errorByIndex = new Map(errors.map((error) => [error.index, error]));

  if (step.key === "read") {
    return (
      <p className="walk-rise text-xl leading-relaxed text-slate-900">
        {tokens.map((token, position) => (
          <span key={token.index}>
            {hasGapBefore(tokens, position) ? " " : ""}
            {token.text}
          </span>
        ))}
      </p>
    );
  }

  if (step.key === "split") {
    return (
      <div className="flex flex-wrap gap-2">
        {tokens.map((token, position) => (
          <Chip
            key={token.index}
            delay={position * 130}
            className="border-slate-300 bg-white text-slate-900"
          >
            {token.text}
          </Chip>
        ))}
      </div>
    );
  }

  if (step.key === "roles") {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {tokens.map((token, position) => {
          const [label] = describePartOfSpeech(token.pos);
          return (
            <div key={token.index} className="flex flex-col items-center gap-1">
              <Chip
                delay={position * 90}
                className="border-slate-300 bg-white text-slate-900"
              >
                {token.text}
              </Chip>
              <span
                className={`walk-rise rounded-full px-2 py-0.5 text-xs font-medium ${partOfSpeechColor(token.pos)}`}
                style={{ animationDelay: `${position * 90 + 350}ms` }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  if (step.key === "connect") {
    return <SentenceTree tokens={tokens} animate />;
  }

  if (step.key === "check") {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-4">
        {tokens.map((token, position) => {
          const error = errorByIndex.get(token.index);
          const delay = position * 160;
          if (token.pos === "PUNCT") {
            return (
              <Chip
                key={token.index}
                delay={delay}
                className="border-slate-300 bg-white text-slate-900"
              >
                {token.text}
              </Chip>
            );
          }
          return (
            <div key={token.index} className="flex max-w-40 flex-col items-center gap-1">
              <span
                className={`${error ? "walk-shake" : "walk-pop"} inline-block rounded-lg border px-3 py-1.5 text-base font-semibold ${
                  error
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                }`}
                style={{ animationDelay: `${delay}ms` }}
              >
                {error ? "✕" : "✓"} {token.text}
              </span>
              {error && (
                <span
                  className="walk-rise text-center text-xs text-red-700"
                  style={{ animationDelay: `${delay + 300}ms` }}
                >
                  {(error.reasons ?? [])
                    .map((reason) => reasonLabels[reason] ?? reason)
                    .join(" and ") || "Needs attention"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <p className="text-xl leading-relaxed text-slate-900">
      {tokens.map((token, position) => {
        const best = errorByIndex.get(token.index)?.suggestions?.[0]?.word;
        const flagged = errorByIndex.has(token.index);
        return (
          <span key={token.index}>
            {hasGapBefore(tokens, position) ? " " : ""}
            {best ? (
              <>
                <span
                  className="walk-fade-out text-red-600 line-through"
                  style={{ animationDelay: "400ms" }}
                >
                  {token.text}
                </span>{" "}
                <span
                  className="walk-pop inline-block rounded bg-emerald-100 px-1 font-semibold text-emerald-800"
                  style={{ animationDelay: "1000ms" }}
                >
                  {best}
                </span>
              </>
            ) : (
              <span className={flagged ? "text-amber-700 underline" : ""}>
                {token.text}
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}

export default function AnalysisWalkthrough({ tokens, errors, weights }) {
  const correctable = useMemo(
    () => errors.filter((error) => error.suggestions?.length > 0),
    [errors],
  );
  const steps = useMemo(
    () => buildSteps(correctable.length > 0 && Boolean(weights)),
    [correctable.length, weights],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [focus, setFocus] = useState(0);
  const current = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;
  const isPlaying = playing && !isLast;
  const isCorrectionStep = correctionStepKeys.has(current.key);
  const focused = correctable[Math.min(focus, correctable.length - 1)];

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setTimeout(
      () => setStepIndex((index) => index + 1),
      current.seconds * 1000,
    );
    return () => clearTimeout(timer);
  }, [isPlaying, current]);

  function goTo(index) {
    setStepIndex(Math.max(0, Math.min(index, steps.length - 1)));
  }

  function handlePlayPause() {
    if (isLast) {
      setStepIndex(0);
      setPlaying(true);
    } else {
      setPlaying(!playing);
    }
  }

  const buttonClass =
    "rounded-md bg-[#e8e7e7] px-3 py-1.5 text-sm font-semibold text-[#3b3b3b] shadow-sm transition hover:bg-[#ddd] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <section className="mb-5 rounded-lg border border-[#d8cfd1] bg-white p-4">
      <h3 className="mb-1 text-lg font-bold text-[#3c3034]">
        How your text was analyzed
      </h3>
      <p className="mb-3 text-sm text-slate-600">
        Watch each step Ca-Spell takes, from reading your text to choosing a
        correction.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist">
        {steps.map((step, index) => (
          <button
            key={step.key}
            type="button"
            role="tab"
            aria-selected={index === stepIndex}
            aria-label={`Step ${index + 1}: ${step.title}`}
            title={step.title}
            onClick={() => goTo(index)}
            className={`h-2.5 rounded-full transition-all ${
              index === stepIndex
                ? "w-8 bg-[#800000]"
                : index < stepIndex
                  ? "w-2.5 bg-[#c98a8a]"
                  : "w-2.5 bg-slate-300"
            }`}
          />
        ))}
      </div>

      <div aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#800000]">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <h4 className="text-base font-bold text-slate-900">{current.title}</h4>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          {current.description}
        </p>
      </div>

      {isCorrectionStep && correctable.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">Flagged word:</span>
          {correctable.map((error, index) => (
            <button
              key={error.index}
              type="button"
              onClick={() => setFocus(index)}
              className={`rounded-full border px-3 py-0.5 font-medium ${
                index === focus
                  ? "border-[#800000] bg-[#800000] text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-[#800000]"
              }`}
            >
              {error.text}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[28rem] min-h-32 overflow-y-auto rounded-md border border-[#e5dcdd] bg-[#faf8f8] p-4">
        {isCorrectionStep && focused ? (
          <CorrectionStage
            key={`${current.key}-${focused.index}`}
            stepKey={current.key}
            focused={{ error: focused, suggestions: focused.suggestions }}
            tokens={tokens}
            weights={weights}
          />
        ) : (
          <Stage key={current.key} step={current} tokens={tokens} errors={errors} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => goTo(stepIndex - 1)}
          disabled={stepIndex === 0}
          className={buttonClass}
        >
          Back
        </button>
        <button type="button" onClick={handlePlayPause} className={buttonClass}>
          {isPlaying ? "Pause" : isLast ? "Replay" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => goTo(stepIndex + 1)}
          disabled={isLast}
          className={buttonClass}
        >
          Next
        </button>
      </div>
    </section>
  );
}
