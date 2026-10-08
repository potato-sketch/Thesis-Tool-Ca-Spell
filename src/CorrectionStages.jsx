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

function CheckRow({ ok, delay, tag, children }) {
  return (
    <div className="flex items-start gap-2 text-sm text-slate-800">
      <span
        className={`walk-pop mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${ok ? "bg-emerald-500" : "bg-red-500"}`}
        style={{ animationDelay: `${delay + 350}ms` }}
      >
        {ok ? "✓" : "✕"}
      </span>
      <span className="walk-rise" style={{ animationDelay: `${delay}ms` }}>
        <span className="mr-1.5 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">{tag}</span>
        {children}
      </span>
    </div>
  );
}

function FormulaStrip({ children, delay = 200 }) {
  return (
    <p
      className="walk-rise mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-relaxed text-slate-800"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </p>
  );
}

function Term({ children }) {
  return <b className="text-[#800000]">{children}</b>;
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

const mapOrder = ["spelling", "neighborhood", "mixing", "fit", "pas", "uds", "context", "final"];

function MapNode({ acronym, label, weight, state, delay, ta }) {
  const styles = {
    active: "border-[#800000] bg-[#800000] text-white",
    done: "border-emerald-300 bg-emerald-50 text-emerald-800",
    pending: "border-slate-300 bg-white text-slate-600",
  };
  return (
    <span
      className={`walk-pop inline-flex flex-col rounded-lg border px-2 py-1 text-left ${styles[state]} ${ta ? "ring-2 ring-[#800000]/30" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex items-center gap-1.5 text-xs font-bold">
        {state === "done" ? "✓ " : ""}
        {acronym}
        {weight != null && (
          <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-medium">
            {Math.round(weight * 100)}%
          </span>
        )}
      </span>
      <span className="text-[10px] font-medium leading-tight opacity-90">{label}</span>
    </span>
  );
}

const branch =
  "relative my-1 pl-6 before:absolute before:left-0 before:top-0 before:h-full before:border-l-2 before:border-slate-300 after:absolute after:left-0 after:top-4 after:w-4 after:border-t-2 after:border-slate-300 last:before:h-4";

// The scoring recipe as a tree: the final score is built from the parts below it.
function ScoreMap({ active, done, weights, animate }) {
  const stateOf = (key) => (active.includes(key) ? "active" : done.includes(key) ? "done" : "pending");
  const delay = (key) => (animate ? 300 + mapOrder.indexOf(key) * 450 : 0);
  return (
    <div>
      <ul>
        <li>
          <MapNode acronym="FCS" label="Final Candidate Score" state={stateOf("final")} delay={0} />
          <ul className="ml-3 mt-1">
            <li className={branch}>
              <MapNode acronym="EDS" label="Edit Distance Score" weight={weights.edit_distance} state={stateOf("spelling")} delay={delay("spelling")} />
            </li>
            <li className={branch}>
              <MapNode acronym="DCS" label="Dependency Compatibility Score" weight={weights.dependency_compatibility} state={stateOf("fit")} delay={delay("fit")} ta />
              <ul className="ml-3 mt-1">
                <li className={branch}>
                  <MapNode acronym="DNA" label="Dependency Neighborhood Analysis" weight={weights.dependency_neighborhood} state={stateOf("neighborhood")} delay={delay("neighborhood")} ta />
                </li>
                <li className={branch}>
                  <MapNode acronym="CLDC" label="Cross-Language Dependency Compatibility" weight={weights.cross_language} state={stateOf("mixing")} delay={delay("mixing")} ta />
                </li>
              </ul>
            </li>
            {weights.corpus_loaded && (
              <li className={branch}>
                <MapNode acronym="CS" label="Context Score (Correct Taglish Corpus)" weight={weights.context_score} state={stateOf("context")} delay={delay("context")} />
                <ul className="ml-3 mt-1">
                  <li className={branch}>
                    <MapNode acronym="PAS" label="POS Annotation Score" weight={weights.pos_annotation} state={stateOf("pas")} delay={delay("pas")} />
                  </li>
                  <li className={branch}>
                    <MapNode acronym="UDS" label="Universal Dependency Score" weight={weights.universal_dependency} state={stateOf("uds")} delay={delay("uds")} />
                  </li>
                </ul>
              </li>
            )}
          </ul>
        </li>
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        <span className="rounded ring-2 ring-[#800000]/30">&nbsp;&nbsp;</span> DNA, CLDC and DCS together are the
        Taglish-Aware Weighted Dependency Compatibility Algorithm (TA-WDCA).
        {!weights.corpus_loaded && " No Correct Taglish Corpus is loaded, so CS is left out and the other weights are scaled to add up to 100%."}
      </p>
    </div>
  );
}

const mapState = {
  similar: { active: ["spelling"], done: [] },
  place: { active: [], done: ["spelling"] },
  neighborhood: { active: ["neighborhood"], done: ["spelling"] },
  mixing: { active: ["mixing"], done: ["spelling", "neighborhood"] },
  fit: { active: ["fit"], done: ["spelling", "neighborhood", "mixing"] },
  context: { active: ["pas", "uds", "context"], done: ["spelling", "neighborhood", "mixing", "fit"] },
  rank: { active: ["final"], done: ["spelling", "neighborhood", "mixing", "fit", "pas", "uds", "context"] },
};

const tagLabel = (tag) => (tag === "<s>" ? "start" : tag === "</s>" ? "end" : tag === "<root>" ? "root" : tag);

function TagChip({ children }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">{tagLabel(children)}</span>;
}

function PatternChips({ pattern, kind }) {
  if (kind === "pos") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {pattern.split(" ").map((tag, index) => (
          <TagChip key={index}>{tag}</TagChip>
        ))}
      </span>
    );
  }
  const [head, relation, dependent] = pattern.split("|");
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <TagChip>{head}</TagChip>
      <span className="text-xs text-slate-500">— {describeRelationship(relation)[0].toLowerCase()} →</span>
      <TagChip>{dependent}</TagChip>
    </span>
  );
}

function RuleList({ rules, kind, delay }) {
  if (rules.length === 0) {
    return <p className="text-sm text-slate-500">No rules apply to this word.</p>;
  }
  return (
    <div className="space-y-1.5">
      {rules.map((rule, index) => (
        <div
          key={rule.pattern}
          className="walk-rise flex flex-wrap items-center gap-2 text-sm"
          style={{ animationDelay: `${delay + index * 500}ms` }}
        >
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${rule.count > 0 ? "bg-emerald-500" : "bg-red-500"}`}
          >
            {rule.count > 0 ? "✓" : "✕"}
          </span>
          <PatternChips pattern={rule.pattern} kind={kind} />
          <span className="text-xs text-slate-500">
            {rule.count > 0 ? `seen ${rule.count}× in the corpus` : "never seen in the corpus"}
          </span>
        </div>
      ))}
    </div>
  );
}

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
      ["EDS", "Edit Distance Score", "How close the spelling is to what you typed, from the number of edits."],
      ["DNA", "Dependency Neighborhood Analysis", "Does the word play a sensible role among its neighbors?"],
      ["CLDC", "Cross-Language Dependency Compatibility", "Do the English and Tagalog words around it work together?"],
      ["DCS", "Dependency Compatibility Score", "DNA and CLDC, each multiplied by a weight and added."],
      ...(weights.corpus_loaded
        ? [
            ["PAS", "POS Annotation Score", "How many of the candidate's three-tag patterns appear in the Correct Taglish Corpus."],
            ["UDS", "Universal Dependency Score", "How many of the candidate's dependency relations appear in the corpus."],
            ["CS", "Context Score", "PAS and UDS, each multiplied by 0.5 and added."],
          ]
        : []),
      ["FCS", "Final Candidate Score", weights.corpus_loaded ? "EDS, DCS and CS, each multiplied by a weight and added. The highest FCS wins." : "EDS and DCS, each multiplied by a weight and added. The highest FCS wins."],
    ];
    return (
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <ScoreMap active={[]} done={[]} weights={weights} animate />
          <p className="walk-rise mt-3 text-xs text-slate-500" style={{ animationDelay: "2600ms" }}>
            The percentage is how much each part counts toward its total. c is the candidate word being scored.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-slate-700">
          {legend.map(([acronym, label, text], index) => (
            <li key={acronym} className="walk-rise" style={{ animationDelay: `${700 + index * 450}ms` }}>
              <strong className="text-slate-900">
                {acronym} <span className="font-semibold">({label}):</span>
              </strong>{" "}
              {text}
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
          Edit distance: which real words are within {weights.max_edit_distance} letter edits of{" "}
          <span className="text-red-700">{error.text}</span>?
          {summary.candidates_considered ? ` ${summary.candidates_considered} were tested; the best five are shown.` : ""}
        </Lead>
        <FormulaStrip>
          <Term>EDS</Term>(c) = 1 − edits ÷ ({weights.max_edit_distance} + 1) <span className="text-slate-500">(an edit adds, removes or replaces one letter)</span>
        </FormulaStrip>
        <p className="walk-rise mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
          {edits.map((count) => `${count} ${count === 1 ? "edit" : "edits"} = EDS ${format(1 - count / (weights.max_edit_distance + 1))}`).join(" · ")}
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
                <span className="w-28 shrink-0 text-xs text-slate-500">EDS</span>
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
            tag: "POS",
            ok: dna.pos,
            text: `Can a ${describePartOfSpeech(role.pos)[0].toLowerCase()} be the "${describeRelationship(role.relation)[0].toLowerCase()}"?`,
          },
          {
            key: "head",
            tag: "HEAD",
            ok: dna.head,
            text: role.original_head
              ? `Does it attach to "${role.original_head}", like the typo did?`
              : "Is it the main word of the sentence, like the typo was?",
          },
          {
            key: "rel",
            tag: "REL",
            ok: dna.rel,
            text: "Is its relationship valid: no second subject or object, and no clash between verb tense and time word?",
          },
          {
            key: "neighbor",
            tag: "NEIGHBOR",
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
        <Lead>Dependency Neighborhood Analysis (DNA): does the candidate play a sensible role among its neighbors?</Lead>
        <FormulaStrip>
          <Term>DNA</Term>(c) = (<Term>POS</Term>(c) + <Term>HEAD</Term>(c) + <Term>REL</Term>(c) + <Term>NEIGHBOR</Term>(c)) ÷ 4{" "}
          <span className="text-slate-500">(each check is 1 if passed, 0 if not)</span>
        </FormulaStrip>
        <CandidatePicker suggestions={suggestions} value={candidateFocus} onChange={onCandidateFocus} />
        {dna && (
          <div key={item.word} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <Card>
              <RoleDiagram word={item.word} role={role} />
            </Card>
            <div className="space-y-2">
              {checks.map((check, index) => (
                <CheckRow key={check.key} ok={check.ok} tag={check.tag} delay={checkDelay(index)}>
                  {check.text}
                </CheckRow>
              ))}
              <div className="pt-2">
                <Blocks results={checks.map((check) => check.ok)} delays={checks.map((_, index) => checkDelay(index) + 450)} />
                <p className="walk-rise mt-1 text-xs text-slate-600" style={{ animationDelay: `${checkDelay(3) + 700}ms` }}>
                  {passed} of 4 checks passed
                </p>
                <div className="mt-2">
                  <ScoreBadge label="DNA(c)" value={dna.score} delay={checkDelay(3) + 1100} />
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
        <Lead>Cross-Language Dependency Compatibility (CLDC): do the English and Tagalog words around the candidate work together?</Lead>
        <FormulaStrip>
          <Term>CLDC</Term>(c) = valid cross-language relations ÷ total cross-language relations{" "}
          <span className="text-slate-500">(no mixed relations = 1)</span>
        </FormulaStrip>
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
              <ScoreBadge label="CLDC(c)" value={cldc.score} delay={cldc.relations.length * 700 + 1200} />
            </div>
          </Card>
        )}
      </div>
    );
  } else if (stepKey === "fit") {
    const neighborhood = item.scores.dependency_neighborhood;
    const mixing = item.scores.cross_language;
    const parts = [
      { label: "DNA", name: "Dependency Neighborhood Analysis", weight: weights.dependency_neighborhood, score: neighborhood, color: "bg-sky-500" },
      { label: "CLDC", name: "Cross-Language Dependency Compatibility", weight: weights.cross_language, score: mixing, color: "bg-violet-500" },
    ];
    content = (
      <div>
        <Lead>Dependency Compatibility Score (DCS): how well does the candidate fit the sentence overall?</Lead>
        <FormulaStrip>
          <Term>DCS</Term>(c) = w1 × <Term>DNA</Term>(c) + w2 × <Term>CLDC</Term>(c){" "}
          <span className="text-slate-500">
            where w1 = {format(weights.dependency_neighborhood)}, w2 = {format(weights.cross_language)}
          </span>
        </FormulaStrip>
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
                <strong>{part.label}</strong>{" "}
                <span className="text-xs text-slate-500">{part.name}</span>
                <p className="mt-1 font-mono text-xs text-slate-700">
                  {part.label}(c) {format(part.score)} × w {format(part.weight)} ={" "}
                  <span className="font-bold">{format(part.weight * part.score)}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <ScoreBadge label="DCS(c)" value={item.scores.dependency_compatibility} delay={2400} />
          </div>
        </Card>
      </div>
    );
  } else if (stepKey === "context") {
    const context = item.details?.context;
    const rulesDelay = 400;
    const posEnd = context ? rulesDelay + context.pos_rules.length * 500 + 1200 : 0;
    const depEnd = context ? posEnd + context.dependency_rules.length * 500 + 1200 : 0;
    content = (
      <div>
        <Lead>Context Score (CS): do this candidate's patterns appear in the Correct Taglish Corpus?</Lead>
        <FormulaStrip>
          <Term>PAS</Term>(c) = satisfied POS annotation rules ÷ total POS annotation rules<br />
          <Term>UDS</Term>(c) = satisfied dependency relations ÷ total dependency relations<br />
          <Term>CS</Term>(c) = {format(weights.pos_annotation)} × <Term>PAS</Term>(c) + {format(weights.universal_dependency)} × <Term>UDS</Term>(c)
        </FormulaStrip>
        <CandidatePicker suggestions={suggestions} value={candidateFocus} onChange={onCandidateFocus} />
        {context && (
          <Card key={item.word}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              POS annotation rules (three tags in a row around the candidate)
            </p>
            <RuleList rules={context.pos_rules} kind="pos" delay={rulesDelay} />
            <div className="mt-2">
              <Blocks
                results={context.pos_rules.map((rule) => rule.count > 0)}
                delays={context.pos_rules.map((_, index) => rulesDelay + index * 500 + 300)}
              />
              <div className="mt-2">
                <ScoreBadge label="PAS(c)" value={context.pas} delay={posEnd - 300} />
              </div>
            </div>
            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dependency relations (the candidate and its head or dependents)
            </p>
            <RuleList rules={context.dependency_rules} kind="dep" delay={posEnd} />
            <div className="mt-2">
              <Blocks
                results={context.dependency_rules.map((rule) => rule.count > 0)}
                delays={context.dependency_rules.map((_, index) => posEnd + index * 500 + 300)}
              />
              <div className="mt-2">
                <ScoreBadge label="UDS(c)" value={context.uds} delay={depEnd - 300} />
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3">
              <ScoreBadge label="CS(c)" value={context.cs} delay={depEnd + 800} />
            </div>
          </Card>
        )}
      </div>
    );
  } else {
    const corpus = weights.corpus_loaded;
    const parts = (candidate) => [
      { label: "EDS", weight: weights.edit_distance, value: weights.edit_distance * candidate.scores.edit_distance, color: "bg-[#800000]" },
      { label: "DCS", weight: weights.dependency_compatibility, value: weights.dependency_compatibility * candidate.scores.dependency_compatibility, color: "bg-sky-500" },
      ...(corpus
        ? [{ label: "CS", weight: weights.context_score, value: weights.context_score * (candidate.scores.context_score ?? 0), color: "bg-amber-500" }]
        : []),
    ];
    const legendParts = parts(suggestions[0]);
    content = (
      <div>
        <Lead>Final Candidate Score (FCS): which candidate wins?</Lead>
        <FormulaStrip>
          <Term>FCS</Term>(c) = w1 × <Term>EDS</Term>(c) + w2 × <Term>DCS</Term>(c){corpus && <> + w3 × <Term>CS</Term>(c)</>}{" "}
          <span className="text-slate-500">
            where {legendParts.map((part, index) => `w${index + 1} = ${format(part.weight)}`).join(", ")}
            {!corpus && " (no Correct Taglish Corpus is loaded, so CS is left out and the weights are scaled to add up to 1)"}
          </span>
        </FormulaStrip>
        <p className="walk-rise mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-700">
          {legendParts.map((part, index) => (
            <span key={part.label}>
              <span className={`mr-1 inline-block h-3 w-3 rounded ${part.color}`} />w{index + 1} × {part.label}
            </span>
          ))}
          <span>A longer bar means a higher FCS.</span>
        </p>
        <div className="space-y-2">
          {suggestions.map((candidate, position) => {
            const best = position === 0;
            const base = position * 800;
            const rowParts = parts(candidate);
            return (
              <Card key={candidate.word} delay={base} className={best ? "border-[#e8d169] bg-[#f7f1c5]" : ""}>
                <div className="flex items-center gap-3">
                  <span className="w-5 text-sm font-bold text-slate-700">{position + 1}</span>
                  <span className={`w-28 shrink-0 truncate font-semibold ${best ? "text-emerald-700" : "text-slate-700"}`}>
                    {candidate.word}
                  </span>
                  <StackedBar delay={base + 300} segments={rowParts} />
                  <span className="w-10 text-right font-mono text-sm font-bold text-slate-900">{format(candidate.score)}</span>
                </div>
                <p className="walk-rise mt-1 pl-8 font-mono text-xs text-slate-600" style={{ animationDelay: `${base + 1200}ms` }}>
                  {rowParts.map((part, index) => `${format(part.value)} (w${index + 1} × ${part.label})`).join(" + ")} = FCS {format(candidate.score)}
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
    <div className="grid gap-4 md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <div className="self-start rounded-md border border-slate-200 bg-white p-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Where we are</p>
        <ScoreMap active={state.active} done={state.done} weights={weights} />
      </div>
      {content}
    </div>
  );
}
