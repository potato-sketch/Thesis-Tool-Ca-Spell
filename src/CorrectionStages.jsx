import { useEffect, useState } from "react";
import {
  describePartOfSpeech,
  describeRelationship,
  hasGapBefore,
} from "./analysisLabels";

const languageNames = {
  english: "English",
  tagalog: "Tagalog",
  taglish: "Taglish",
};

const languageColors = {
  english: "bg-violet-100 text-violet-800",
  tagalog: "bg-sky-100 text-sky-800",
  taglish: "bg-amber-100 text-amber-800",
};

function format(value) {
  return Number(value ?? 0).toFixed(2);
}

function alignWords(from, to) {
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  const table = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array(b.length).fill(0),
  ]);
  for (let j = 1; j <= b.length; j++) table[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      table[i][j] = Math.min(
        table[i - 1][j] + 1,
        table[i][j - 1] + 1,
        table[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  const pieces = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const same = i > 0 && j > 0 && a[i - 1] === b[j - 1];
    if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1] + (same ? 0 : 1)) {
      pieces.push(
        same
          ? { kind: "same", char: to[j - 1] }
          : { kind: "replace", from: from[i - 1], char: to[j - 1] },
      );
      i--;
      j--;
    } else if (i > 0 && table[i][j] === table[i - 1][j] + 1) {
      pieces.push({ kind: "remove", char: from[i - 1] });
      i--;
    } else {
      pieces.push({ kind: "add", char: to[j - 1] });
      j--;
    }
  }
  return pieces.reverse();
}

function useCountUp(target, delay) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const timer = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(timer);
    }
    let frame;
    let start;
    const timer = setTimeout(() => {
      const tick = (now) => {
        start ??= now;
        const progress = Math.min(1, (now - start) / 900);
        setValue(target * (1 - (1 - progress) ** 3));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, delay]);
  return value;
}

function LanguagePill({ language }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${languageColors[language] ?? "bg-slate-100 text-slate-700"}`}>
      {languageNames[language] ?? language}
    </span>
  );
}

function WordDiff({ from, to, delay }) {
  const pieces = alignWords(from, to);
  return (
    <span className="font-mono text-xl">
      {pieces.map((piece, index) => {
        const style = { animationDelay: `${delay + index * 70}ms` };
        if (piece.kind === "same") {
          return <span key={index} className="walk-pop inline-block text-slate-800" style={style}>{piece.char}</span>;
        }
        if (piece.kind === "add") {
          return <span key={index} className="walk-pop inline-block rounded bg-emerald-200 px-0.5 font-bold text-emerald-900" style={style}>{piece.char}</span>;
        }
        if (piece.kind === "remove") {
          return <span key={index} className="walk-pop inline-block text-sm text-red-600 line-through" style={style}>{piece.char}</span>;
        }
        return (
          <span key={index} className="walk-pop inline-block" style={style}>
            <span className="text-sm text-red-600 line-through">{piece.from}</span>
            <span className="rounded bg-amber-200 px-0.5 font-bold text-amber-900">{piece.char}</span>
          </span>
        );
      })}
    </span>
  );
}

function Sentence({ tokens, index, word }) {
  return (
    <span>
      {tokens.map((token, position) => (
        <span key={token.index}>
          {hasGapBefore(tokens, position) ? " " : ""}
          {token.index === index ? (
            <span className="rounded bg-emerald-100 px-1 font-semibold text-emerald-800">
              {word}
            </span>
          ) : (
            token.text
          )}
        </span>
      ))}
    </span>
  );
}

function Lead({ children }) {
  return <p className="mb-3 text-sm font-medium text-slate-800">{children}</p>;
}

function Card({ delay = 0, children, className = "" }) {
  return (
    <div
      className={`walk-rise rounded-lg border border-slate-200 bg-white p-3 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Bar({ value, delay, color = "bg-emerald-500" }) {
  return (
    <div className="h-3 min-w-0 flex-1 rounded-full bg-slate-100">
      <div
        className={`walk-grow h-3 rounded-full ${color}`}
        style={{
          "--w": `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`,
          animationDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

// Each segment is a part's weighted share of the total, so the bar's length is the score.
function StackedBar({ segments, delay }) {
  return (
    <div className="flex h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
      {segments.map((segment, index) => (
        <div
          key={segment.label}
          title={segment.label}
          className={`walk-grow h-5 ${segment.color}`}
          style={{
            "--w": `${(Math.max(0, segment.value) * 100).toFixed(1)}%`,
            animationDelay: `${delay + index * 700}ms`,
          }}
        />
      ))}
    </div>
  );
}

function ScoreBadge({ label, value, delay }) {
  const shown = useCountUp(value, delay);
  return (
    <div className="walk-pop inline-flex items-baseline gap-2 rounded-lg bg-emerald-50 px-3 py-1.5" style={{ animationDelay: `${delay - 300}ms` }}>
      <span className="text-xs font-medium text-emerald-900">{label}</span>
      <span className="font-mono text-xl font-bold text-emerald-700">{shown.toFixed(2)}</span>
    </div>
  );
}

// One block per check; the filled blocks are the score.
function Blocks({ results, delays }) {
  return (
    <div className="flex gap-1.5">
      {results.map((ok, index) => (
        <span
          key={index}
          className={`walk-pop h-5 flex-1 rounded ${ok ? "bg-emerald-500" : "bg-red-300"}`}
          style={{ animationDelay: `${delays[index]}ms` }}
        />
      ))}
    </div>
  );
}

function CheckRow({ ok, delay, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-800">
      <span
        className={`walk-pop mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${ok ? "bg-emerald-500" : "bg-red-500"}`}
        style={{ animationDelay: `${delay + 350}ms` }}
      >
        {ok ? "✓" : "✕"}
      </span>
      <span className="walk-rise" style={{ animationDelay: `${delay}ms` }}>
        {children}
      </span>
    </div>
  );
}

function CandidatePicker({ suggestions, value, onChange }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-600">Candidate:</span>
      {suggestions.map((item, index) => (
        <button
          key={item.word}
          type="button"
          onClick={() => onChange(index)}
          className={`rounded-full border px-3 py-0.5 font-medium ${
            index === value
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:border-emerald-600"
          }`}
        >
          {item.word}
        </button>
      ))}
    </div>
  );
}

const mapOrder = ["spelling", "neighborhood", "mixing", "fit", "final"];

function MapNode({ label, weight, state, delay }) {
  const styles = {
    active: "border-[#800000] bg-[#800000] text-white",
    done: "border-emerald-300 bg-emerald-50 text-emerald-800",
    pending: "border-slate-300 bg-white text-slate-600",
  };
  return (
    <span
      className={`walk-pop inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${styles[state]}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {state === "done" ? "✓ " : ""}
      {label}
      {weight != null && (
        <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-medium">
          {Math.round(weight * 100)}%
        </span>
      )}
    </span>
  );
}

const branch =
  "relative my-1 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:border-l-2 before:border-slate-300 after:absolute after:left-0 after:top-4 after:w-4 after:border-t-2 after:border-slate-300 last:before:h-4";

// The scoring recipe as a tree: the final score is built from the parts below it.
function ScoreMap({ active, done, weights, animate }) {
  const stateOf = (key) => (active === key ? "active" : done.includes(key) ? "done" : "pending");
  const delay = (key) => (animate ? 300 + mapOrder.indexOf(key) * 450 : 0);
  return (
    <ul>
      <li>
        <MapNode label="Final score" state={stateOf("final")} delay={0} />
        <ul className="ml-3 mt-1">
          <li className={branch}>
            <MapNode label="Spelling similarity" weight={weights.edit_distance} state={stateOf("spelling")} delay={delay("spelling")} />
          </li>
          <li className={branch}>
            <MapNode label="Sentence fit" weight={weights.dependency_compatibility} state={stateOf("fit")} delay={delay("fit")} />
            <ul className="ml-3 mt-1">
              <li className={branch}>
                <MapNode label="Neighborhood" weight={weights.dependency_neighborhood} state={stateOf("neighborhood")} delay={delay("neighborhood")} />
              </li>
              <li className={branch}>
                <MapNode label="Language mixing" weight={weights.cross_language} state={stateOf("mixing")} delay={delay("mixing")} />
              </li>
            </ul>
          </li>
        </ul>
      </li>
    </ul>
  );
}

const mapState = {
  similar: { active: "spelling", done: [] },
  place: { active: null, done: ["spelling"] },
  neighborhood: { active: "neighborhood", done: ["spelling"] },
  mixing: { active: "mixing", done: ["spelling", "neighborhood"] },
  fit: { active: "fit", done: ["spelling", "neighborhood", "mixing"] },
  rank: { active: "final", done: ["spelling", "neighborhood", "mixing", "fit"] },
};

function RoleDiagram({ word, role }) {
  const relation = describeRelationship(role.relation)[0];
  return (
    <div className="flex flex-col items-center gap-1 text-sm">
      {role.head ? (
        <>
          <span className="walk-pop rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold">
            {role.head}
            <span className="ml-1 text-xs font-normal text-slate-500">
              ({describePartOfSpeech(role.head_pos)[0].toLowerCase()})
            </span>
          </span>
          <span className="walk-rise text-xs text-slate-500" style={{ animationDelay: "250ms" }}>
            ↑ {relation.toLowerCase()}
          </span>
        </>
      ) : (
        <span className="walk-rise text-xs text-slate-500">main word of the sentence</span>
      )}
      <span
        className="walk-pop rounded-lg border-2 border-emerald-500 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800"
        style={{ animationDelay: "400ms" }}
      >
        {word}
        <span className="ml-1 text-xs font-normal">({describePartOfSpeech(role.pos)[0].toLowerCase()})</span>
      </span>
      {role.dependents.length > 0 && (
        <>
          <span className="walk-rise text-xs text-slate-500" style={{ animationDelay: "650ms" }}>
            ↓ attached to it
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {role.dependents.map((dependent, index) => (
              <span
                key={`${dependent.text}-${index}`}
                className="walk-pop rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                style={{ animationDelay: `${800 + index * 200}ms` }}
              >
                <span className="font-semibold">{dependent.text}</span>{" "}
                <span className="text-slate-500">{describeRelationship(dependent.relation)[0].toLowerCase()}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CorrectionStage({ stepKey, focused, tokens, weights, candidateFocus, onCandidateFocus }) {
  const { error, suggestions } = focused;
  const summary = suggestions[0]?.details ?? {};
  const item = suggestions[Math.min(candidateFocus, suggestions.length - 1)];

  if (stepKey === "overview") {
    const legend = [
      ["Spelling similarity", "How close the spelling is to what you typed."],
      ["Neighborhood", "Does the word play a sensible role among its neighbors?"],
      ["Language mixing", "Do the English and Tagalog words around it work together?"],
      ["Sentence fit", "Neighborhood and language mixing, added with their weights."],
      ["Final score", "Spelling similarity and sentence fit, added with their weights. Highest wins."],
    ];
    return (
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <ScoreMap active={null} done={[]} weights={weights} animate />
          <p className="walk-rise mt-3 text-xs text-slate-500" style={{ animationDelay: "2600ms" }}>
            The percentage is how much each part counts toward its total.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          {legend.map(([label, text], index) => (
            <li key={label} className="walk-rise" style={{ animationDelay: `${700 + index * 450}ms` }}>
              <strong className="text-slate-900">{label}:</strong> {text}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  let content;

  if (stepKey === "similar") {
    const edits = Array.from({ length: weights.max_edit_distance + 1 }, (_, count) => count);
    content = (
      <div>
        <Lead>
          Which real words look like <span className="text-red-700">{error.text}</span>?
          {summary.candidates_considered ? ` ${summary.candidates_considered} were tested; the best five are shown.` : ""}
        </Lead>
        <p className="walk-rise mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
          Spelling similarity drops with every edit:{" "}
          {edits.map((count) => `${count} ${count === 1 ? "edit" : "edits"} = ${format(1 - count / (weights.max_edit_distance + 1))}`).join(" · ")}
          <span className="ml-2">
            <span className="rounded bg-emerald-200 px-1">added</span>{" "}
            <span className="rounded bg-amber-200 px-1">replaced</span>{" "}
            <span className="text-red-600 line-through">removed</span>
          </span>
        </p>
        <div className="space-y-2">
          {suggestions.map((candidate, position) => (
            <Card key={candidate.word} delay={position * 600}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-red-700 line-through">{error.text}</span>
                  <span className="text-slate-400">→</span>
                  <WordDiff from={error.text} to={candidate.word} delay={position * 600 + 300} />
                </div>
                <div className="flex items-center gap-2">
                  {candidate.languages.map((language) => (
                    <LanguagePill key={language} language={language} />
                  ))}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {candidate.edit_distance} edit{candidate.edit_distance === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-slate-500">Spelling similarity</span>
                <Bar value={candidate.scores.edit_distance} delay={position * 600 + 900} color="bg-[#800000]" />
                <span className="w-10 text-right font-mono text-sm font-semibold text-slate-800">
                  {format(candidate.scores.edit_distance)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  } else if (stepKey === "place") {
    content = (
      <div>
        <Lead>How does each candidate read in your sentence?</Lead>
        <div className="space-y-2">
          {suggestions.map((candidate, position) => (
            <Card key={candidate.word} delay={position * 350}>
              <p className="text-base text-slate-900">
                <Sentence tokens={tokens} index={error.index} word={candidate.word} />
              </p>
            </Card>
          ))}
        </div>
        <p className="walk-rise mt-3 text-xs text-slate-500" style={{ animationDelay: "1800ms" }}>
          Each sentence is analyzed again to find every word's role and connections. Next, we judge the candidate's
          role.
        </p>
      </div>
    );
  } else if (stepKey === "neighborhood") {
    const dna = item.details?.dna;
    const role = dna?.role;
    const checks = dna
      ? [
          {
            key: "pos",
            ok: dna.pos,
            text: `Can a ${describePartOfSpeech(role.pos)[0].toLowerCase()} be the "${describeRelationship(role.relation)[0].toLowerCase()}"?`,
          },
          {
            key: "head",
            ok: dna.head,
            text: role.original_head
              ? `Does it attach to "${role.original_head}", like the typo did?`
              : "Is it the main word of the sentence, like the typo was?",
          },
          {
            key: "rel",
            ok: dna.rel,
            text: "Is its relationship valid: no second subject or object, and no clash between verb tense and time word?",
          },
          {
            key: "neighbor",
            ok: dna.neighbor,
            text: role.dependents.length
              ? "Do the words attached to it make sense?"
              : "Nothing is attached to it, so nothing can go wrong.",
          },
        ]
      : [];
    const checkDelay = (index) => 900 + index * 900;
    const passed = checks.filter((check) => check.ok).length;
    content = (
      <div>
        <Lead>Does the candidate play a sensible role among its neighbors?</Lead>
        <CandidatePicker suggestions={suggestions} value={candidateFocus} onChange={onCandidateFocus} />
        {dna && (
          <div key={item.word} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card>
              <RoleDiagram word={item.word} role={role} />
            </Card>
            <div className="space-y-2">
              {checks.map((check, index) => (
                <CheckRow key={check.key} ok={check.ok} delay={checkDelay(index)}>
                  {check.text}
                </CheckRow>
              ))}
              <div className="pt-2">
                <Blocks results={checks.map((check) => check.ok)} delays={checks.map((_, index) => checkDelay(index) + 450)} />
                <p className="walk-rise mt-1 text-xs text-slate-600" style={{ animationDelay: `${checkDelay(3) + 700}ms` }}>
                  {passed} of 4 checks passed
                </p>
                <div className="mt-2">
                  <ScoreBadge label="Neighborhood score" value={dna.score} delay={checkDelay(3) + 1100} />
                </div>
              </div>
            </div>
          </div>
        )}
        {summary.rejected_for_tense_conflict?.length > 0 && (
          <p className="walk-rise mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" style={{ animationDelay: "5200ms" }}>
            Already removed: the verb tense still clashes with a time word in{" "}
            <span className="line-through">{summary.rejected_for_tense_conflict.join(", ")}</span>
          </p>
        )}
      </div>
    );
  } else if (stepKey === "mixing") {
    const cldc = item.details?.cldc;
    content = (
      <div>
        <Lead>Do the English and Tagalog words around the candidate work together?</Lead>
        <CandidatePicker suggestions={suggestions} value={candidateFocus} onChange={onCandidateFocus} />
        {cldc && (
          <Card key={item.word}>
            {cldc.relations.length === 0 ? (
              <div>
                <p className="walk-rise text-sm text-slate-700">
                  No English word is connected to a Tagalog word here, so nothing can clash. Full score.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <Bar value={1} delay={600} />
                </div>
              </div>
            ) : (
              <div>
                <div className="space-y-2">
                  {cldc.relations.map((relation, index) => (
                    <div
                      key={`${relation.head}-${relation.dependent}-${index}`}
                      className="walk-rise flex flex-wrap items-center gap-2 text-sm"
                      style={{ animationDelay: `${index * 700}ms` }}
                    >
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold">{relation.head}</span>
                      <LanguagePill language={relation.head_language} />
                      <span className="text-slate-500">
                        → {describeRelationship(relation.relation)[0].toLowerCase()} →
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold">{relation.dependent}</span>
                      <LanguagePill language={relation.dependent_language} />
                      <span className={`font-semibold ${relation.supported ? "text-emerald-700" : "text-red-700"}`}>
                        {relation.supported ? "✓ works in Taglish" : "✕ not known to work"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Blocks
                    results={cldc.relations.map((relation) => relation.supported)}
                    delays={cldc.relations.map((_, index) => index * 700 + 500)}
                  />
                  <p className="mt-1 text-xs text-slate-600">
                    {cldc.valid} of {cldc.total} mixed connections work
                  </p>
                </div>
              </div>
            )}
            <div className="mt-3">
              <ScoreBadge label="Language mixing score" value={cldc.score} delay={cldc.relations.length * 700 + 1200} />
            </div>
          </Card>
        )}
      </div>
    );
  } else if (stepKey === "fit") {
    const neighborhood = item.scores.dependency_neighborhood;
    const mixing = item.scores.cross_language;
    const parts = [
      { label: "Neighborhood", weight: weights.dependency_neighborhood, score: neighborhood, color: "bg-sky-500" },
      { label: "Language mixing", weight: weights.cross_language, score: mixing, color: "bg-violet-500" },
    ];
    content = (
      <div>
        <Lead>How well does the candidate fit the sentence overall?</Lead>
        <CandidatePicker suggestions={suggestions} value={candidateFocus} onChange={onCandidateFocus} />
        <Card key={item.word}>
          <div className="flex items-center gap-3">
            <span className="w-28 shrink-0 font-semibold text-emerald-700">{item.word}</span>
            <StackedBar
              delay={500}
              segments={parts.map((part) => ({ label: part.label, value: part.weight * part.score, color: part.color }))}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {parts.map((part, index) => (
              <div
                key={part.label}
                className="walk-rise rounded-md bg-slate-50 p-2 text-sm"
                style={{ animationDelay: `${600 + index * 700}ms` }}
              >
                <span className={`mr-2 inline-block h-3 w-3 rounded ${part.color}`} />
                <strong>{part.label}</strong>
                <p className="mt-1 font-mono text-xs text-slate-700">
                  score {format(part.score)} × counts {Math.round(part.weight * 100)}% ={" "}
                  <span className="font-bold">{format(part.weight * part.score)}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <ScoreBadge label="Sentence fit" value={item.scores.dependency_compatibility} delay={2400} />
          </div>
        </Card>
      </div>
    );
  } else {
    const parts = (candidate) => [
      { label: "Spelling similarity", value: weights.edit_distance * candidate.scores.edit_distance, color: "bg-[#800000]" },
      { label: "Sentence fit", value: weights.dependency_compatibility * candidate.scores.dependency_compatibility, color: "bg-sky-500" },
    ];
    content = (
      <div>
        <Lead>Which candidate wins?</Lead>
        <p className="walk-rise mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-700">
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-[#800000]" />Spelling similarity ({Math.round(weights.edit_distance * 100)}%)</span>
          <span><span className="mr-1 inline-block h-3 w-3 rounded bg-sky-500" />Sentence fit ({Math.round(weights.dependency_compatibility * 100)}%)</span>
          <span>A longer bar means a higher final score.</span>
        </p>
        <div className="space-y-2">
          {suggestions.map((candidate, position) => {
            const best = position === 0;
            const base = position * 800;
            const [spelling, fit] = parts(candidate);
            return (
              <Card key={candidate.word} delay={base} className={best ? "border-[#e8d169] bg-[#f7f1c5]" : ""}>
                <div className="flex items-center gap-3">
                  <span className="w-5 text-sm font-bold text-slate-700">{position + 1}</span>
                  <span className={`w-28 shrink-0 truncate font-semibold ${best ? "text-emerald-700" : "text-slate-700"}`}>
                    {candidate.word}
                  </span>
                  <StackedBar delay={base + 300} segments={[spelling, fit]} />
                  <span className="w-10 text-right font-mono text-sm font-bold text-slate-900">{format(candidate.score)}</span>
                </div>
                <p className="walk-rise mt-1 pl-8 font-mono text-xs text-slate-600" style={{ animationDelay: `${base + 1200}ms` }}>
                  {format(spelling.value)} spelling + {format(fit.value)} fit = {format(candidate.score)}
                  {best && (
                    <span className="walk-pop ml-2 rounded-full bg-emerald-600 px-2 py-0.5 font-sans font-semibold text-white" style={{ animationDelay: `${base + 1500}ms` }}>
                      Best match
                    </span>
                  )}
                </p>
              </Card>
            );
          })}
        </div>
        <p className="walk-rise mt-3 text-xs text-slate-500" style={{ animationDelay: `${suggestions.length * 800}ms` }}>
          Ties go to the candidate with fewer edits, then alphabetical order.
        </p>
      </div>
    );
  }

  const state = mapState[stepKey];
  return (
    <div className="grid gap-4 md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <div className="self-start rounded-md border border-slate-200 bg-white p-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Where we are</p>
        <ScoreMap active={state.active} done={state.done} weights={weights} />
      </div>
      {content}
    </div>
  );
}
