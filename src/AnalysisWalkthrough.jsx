import { useEffect, useMemo, useState } from "react";
import CorrectionStage from "./CorrectionStages";
import DetectionStage from "./DetectionStages";
import SentenceTree from "./SentenceTree";
import {
  describePartOfSpeech,
  hasGapBefore,
  partOfSpeechColor,
} from "./analysisLabels";

const detectionStepKeys = new Set([
  "dictionary",
  "codeswitch",
  "annotation",
  "compatibility",
  "candidates",
]);

const correctionStepKeys = new Set([
  "overview",
  "similar",
  "place",
  "neighborhood",
  "mixing",
  "fit",
  "context",
  "rank",
]);

function buildSteps(hasCorrections, applied, corpusLoaded) {
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
      key: "dictionary",
      title: "Dictionary lookup",
      seconds: 7,
      description:
        "Error Detection, step 1: each word is looked up in the English and Tagalog word lists.",
    },
    {
      key: "codeswitch",
      title: "Code-switching and compound word checking",
      seconds: 9,
      description:
        "Error Detection, step 2: words missing from the lists are split into affixes and a root.",
    },
    {
      key: "annotation",
      title: "Context-Aware Linguistic Annotation (Table 3)",
      seconds: 9,
      description:
        "Error Detection, step 3: verbs get an aspect label and time words get a time label.",
    },
    {
      key: "compatibility",
      title: "Context Compatibility Analysis (Table 4)",
      seconds: 9,
      description:
        "Error Detection, step 4: does each verb's aspect agree with its time word?",
    },
    {
      key: "candidates",
      title: "Error candidates",
      seconds: 7,
      description:
        "Words that failed a check are forwarded to the Error Correction Module.",
    },
  ];
  if (hasCorrections) {
    steps.push(
      {
        key: "overview",
        title: "How a candidate is scored (TA-WDCA)",
        seconds: 10,
        description:
          "Every candidate earns a Final Candidate Score. DNA, CLDC and DCS form the Taglish-Aware Weighted Dependency Compatibility Algorithm (TA-WDCA).",
      },
      {
        key: "similar",
        title: "Edit distance and Edit Distance Score (EDS)",
        seconds: 11,
        description: "Candidate words come from the word lists within 2 edits of what you typed (banded edit distance, |i − j| ≤ 2).",
      },
      {
        key: "place",
        title: "Try each word in your sentence",
        seconds: 6,
        description:
          "Spelling alone can't pick the right word, so each one is tested inside your sentence.",
      },
      {
        key: "neighborhood",
        title: "Dependency Neighborhood Analysis (DNA)",
        seconds: 12,
        description: "TA-WDCA part 1: does the candidate play a sensible role among the words around it?",
      },
      {
        key: "mixing",
        title: "Cross-Language Dependency Compatibility (CLDC)",
        seconds: 9,
        description: "TA-WDCA part 2: do the English and Tagalog words around it work together?",
      },
      {
        key: "fit",
        title: "Dependency Compatibility Score (DCS)",
        seconds: 9,
        description: "TA-WDCA part 3: DNA and CLDC are weighted and added into one score.",
      },
      ...(corpusLoaded
        ? [
            {
              key: "context",
              title: "Context Score (CS): PAS and UDS",
              seconds: 15,
              description:
                "The candidate sentence's patterns are looked up in the Correct Taglish Corpus frequency profile.",
            },
          ]
        : []),
      {
        key: "rank",
        title: "Final Candidate Score (FCS) and ranking",
        seconds: 12,
        description: corpusLoaded
          ? "EDS, DCS and CS are weighted into the FCS, then the candidates are ranked."
          : "EDS and DCS are weighted into the FCS, then the candidates are ranked.",
      },
      {
        key: "apply",
        title: applied ? "The corrected sentence" : "Use the best correction",
        seconds: 6,
        description: applied
          ? "The corrections you applied replaced the flagged words. Struck-through words are what you first typed, and the highlighted words are what replaced them."
          : "The best-scoring word replaces the flagged word. Choose Apply in the Suggested corrections panel to make this change in your text.",
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

function Stage({ step, tokens, errors, applied }) {
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

  const replacementFor = (token) =>
    applied
      ? applied[token.index]
      : errorByIndex.get(token.index)?.suggestions?.[0]?.word;
  const result = tokens
    .map(
      (token, position) =>
        (hasGapBefore(tokens, position) ? " " : "") +
        (replacementFor(token) ?? token.text),
    )
    .join("");

  return (
    <div>
    <p className="text-xl leading-relaxed text-slate-900">
      {tokens.map((token, position) => {
        const best = replacementFor(token);
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
    <p
      className="walk-rise mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-base text-emerald-900"
      style={{ animationDelay: "1600ms" }}
    >
      <span className="font-semibold">Corrected sentence:</span> {result}
    </p>
    </div>
  );
}

export default function AnalysisWalkthrough({ tokens, errors, weights, applied }) {
  const correctable = useMemo(
    () => errors.filter((error) => error.suggestions?.length > 0),
    [errors],
  );
  const steps = useMemo(
    () => buildSteps(correctable.length > 0 && Boolean(weights), applied, Boolean(weights?.corpus_loaded)),
    [correctable.length, weights, applied],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [focus, setFocus] = useState(0);
  const [candidateFocus, setCandidateFocus] = useState(0);
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
              onClick={() => {
                setFocus(index);
                setCandidateFocus(0);
              }}
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
        {detectionStepKeys.has(current.key) ? (
          <DetectionStage
            key={current.key}
            stepKey={current.key}
            tokens={tokens}
            errors={errors}
          />
        ) : isCorrectionStep && focused ? (
          <CorrectionStage
            key={`${current.key}-${focused.index}-${candidateFocus}`}
            stepKey={current.key}
            focused={{ error: focused, suggestions: focused.suggestions }}
            tokens={tokens}
            weights={weights}
            candidateFocus={candidateFocus}
            onCandidateFocus={setCandidateFocus}
          />
        ) : (
          <Stage
            key={current.key}
            step={current}
            tokens={tokens}
            errors={errors}
            applied={applied}
          />
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
