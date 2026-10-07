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

const neighborhoodChecks = [
  {
    key: "pos",
    label: "Right kind of word",
    hint: "Its part of speech is one its relationship accepts. An adverb can describe an action, but it cannot be the object of a verb.",
  },
  {
    key: "head",
    label: "Same attachment",
    hint: "It attaches to the same word the flagged word did, and that word can accept this relationship.",
  },
  {
    key: "rel",
    label: "Valid relationship",
    hint: "It is not a second subject or object of the same word, and its verb tense does not contradict a time word.",
  },
  {
    key: "neighbor",
    label: "Fitting dependents",
    hint: "Every word attached to it has a part of speech that its own relationship accepts.",
  },
];

function editOperations(from, to) {
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
  const operations = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const same = i > 0 && j > 0 && a[i - 1] === b[j - 1];
    if (i > 0 && j > 0 && table[i][j] === table[i - 1][j - 1] + (same ? 0 : 1)) {
      if (!same) operations.push(`replace "${a[i - 1]}" with "${b[j - 1]}"`);
      i--;
      j--;
    } else if (i > 0 && table[i][j] === table[i - 1][j] + 1) {
      operations.push(`remove "${a[i - 1]}"`);
      i--;
    } else {
      operations.push(`add "${b[j - 1]}"`);
      j--;
    }
  }
  return operations.reverse();
}

function format(value) {
  return Number(value ?? 0).toFixed(2);
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

function Row({ delay, children, className = "" }) {
  return (
    <div
      className={`walk-rise rounded-lg border border-slate-200 bg-white p-3 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Bar({ value, delay, highlight }) {
  return (
    <div className="h-3 min-w-0 flex-1 rounded-full bg-slate-100">
      <div
        className={`walk-grow h-3 rounded-full ${highlight ? "bg-emerald-500" : "bg-slate-400"}`}
        style={{
          "--w": `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`,
          animationDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

function Formula({ children }) {
  return (
    <p className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-800">
      {children}
    </p>
  );
}

function Explanation({ children }) {
  return <p className="mb-3 text-sm leading-relaxed text-slate-700">{children}</p>;
}

export default function CorrectionStage({ stepKey, focused, tokens, weights }) {
  const { error, suggestions } = focused;
  const flagged = tokens.find((token) => token.index === error.index);
  const summary = suggestions[0]?.details ?? {};

  if (stepKey === "similar") {
    return (
      <div>
        <Explanation>
          Ca-Spell looks through the English and Tagalog word lists for real
          words that are at most {weights.max_edit_distance} edits away from{" "}
          <strong className="text-red-700">{error.text}</strong>. One edit is
          adding, removing, or replacing a single letter.
          {summary.candidates_considered
            ? ` ${summary.candidates_considered} candidate words were tested; the best five are shown.`
            : ""}
        </Explanation>
        <div className="space-y-2">
          {suggestions.map((item, position) => {
            const operations = editOperations(error.text, item.word);
            return (
              <Row key={item.word} delay={position * 250}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-emerald-700">{item.word}</span>
                  <span className="text-xs text-slate-500">
                    {item.languages.map((l) => languageNames[l] ?? l).join(" and ")}
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  {item.edit_distance} edit{item.edit_distance === 1 ? "" : "s"}
                  {operations.length === item.edit_distance
                    ? `: ${operations.join(", ")}`
                    : ""}
                </p>
                <Formula>
                  Spelling similarity = 1 − {item.edit_distance} ÷ {weights.max_edit_distance + 1} ={" "}
                  {format(item.scores.edit_distance)}
                </Formula>
              </Row>
            );
          })}
        </div>
      </div>
    );
  }

  if (stepKey === "place") {
    return (
      <div>
        <Explanation>
          Each candidate is put into your sentence in place of the flagged
          word. Ca-Spell then reads the new sentence again to find each word's
          part of speech and how the words connect.
        </Explanation>
        <div className="space-y-2">
          {suggestions.map((item, position) => (
            <Row key={item.word} delay={position * 250}>
              <p className="text-base text-slate-900">
                <Sentence tokens={tokens} index={error.index} word={item.word} />
              </p>
            </Row>
          ))}
        </div>
      </div>
    );
  }

  if (stepKey === "neighborhood") {
    return (
      <div>
        <Explanation>
          <strong>Dependency neighborhood analysis</strong> looks at the
          candidate, the word it attaches to, and the words attached to it.
          Each candidate passes or fails four checks, and its score is the
          number of checks passed divided by 4.
        </Explanation>
        <ul className="mb-3 space-y-1 text-xs text-slate-600">
          {neighborhoodChecks.map((check) => (
            <li key={check.key}>
              <strong className="text-slate-800">{check.label}:</strong> {check.hint}
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          {suggestions.map((item, position) => {
            const dna = item.details?.dna;
            if (!dna) return null;
            const [posLabel] = describePartOfSpeech(dna.role.pos);
            const [relationLabel] = describeRelationship(dna.role.relation);
            const passed = neighborhoodChecks.filter((check) => dna[check.key]).length;
            return (
              <Row key={item.word} delay={position * 300}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-emerald-700">{item.word}</span>
                  <span className="text-xs text-slate-500">
                    Read as: {posLabel}, {relationLabel.toLowerCase()}
                    {dna.role.head ? `, attached to "${dna.role.head}"` : ""}
                  </span>
                </div>
                <div className="my-2 flex flex-wrap gap-2">
                  {neighborhoodChecks.map((check, checkPosition) => (
                    <span
                      key={check.key}
                      className={`walk-pop rounded-full px-2 py-0.5 text-xs font-medium ${
                        dna[check.key]
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-700"
                      }`}
                      style={{ animationDelay: `${position * 300 + 300 + checkPosition * 150}ms` }}
                    >
                      {dna[check.key] ? "✓" : "✕"} {check.label}
                    </span>
                  ))}
                </div>
                <Formula>
                  Neighborhood score = {passed} ÷ 4 = {format(dna.score)}
                </Formula>
              </Row>
            );
          })}
        </div>
        {summary.rejected_for_tense_conflict?.length > 0 && (
          <p className="walk-rise mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" style={{ animationDelay: "1200ms" }}>
            Removed because the verb tense still contradicts a time word in the
            sentence:{" "}
            <span className="line-through">
              {summary.rejected_for_tense_conflict.join(", ")}
            </span>
          </p>
        )}
      </div>
    );
  }

  if (stepKey === "mixing") {
    return (
      <div>
        <Explanation>
          <strong>Cross-language dependency compatibility</strong> looks at
          every connection between an English word and a Tagalog word around
          the candidate. A connection is allowed when this kind of pairing is
          known to work in Taglish, for example an English noun as the object of
          a Tagalog verb. The score is the allowed connections divided by all
          mixed-language connections. With no mixing there is nothing to
          break, so the score is 1.
        </Explanation>
        <div className="space-y-2">
          {suggestions.map((item, position) => {
            const cldc = item.details?.cldc;
            if (!cldc) return null;
            return (
              <Row key={item.word} delay={position * 300}>
                <span className="font-semibold text-emerald-700">{item.word}</span>
                {cldc.relations.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No English and Tagalog words are connected to this word.
                  </p>
                ) : (
                  <ul className="my-1 space-y-1 text-sm text-slate-700">
                    {cldc.relations.map((relation, relationPosition) => (
                      <li key={`${relation.head}-${relation.dependent}-${relationPosition}`}>
                        {relation.head} ({languageNames[relation.head_language] ?? relation.head_language}) →{" "}
                        {relation.dependent} ({languageNames[relation.dependent_language] ?? relation.dependent_language}) as{" "}
                        {describeRelationship(relation.relation)[0].toLowerCase()}:{" "}
                        <span className={relation.supported ? "text-emerald-700" : "text-red-700"}>
                          {relation.supported ? "allowed" : "not known to work"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Formula>
                  Language mixing score ={" "}
                  {cldc.total === 0 ? "1 (no mixing)" : `${cldc.valid} ÷ ${cldc.total}`} = {format(cldc.score)}
                </Formula>
              </Row>
            );
          })}
        </div>
      </div>
    );
  }

  if (stepKey === "fit") {
    return (
      <div>
        <Explanation>
          The <strong>dependency compatibility score</strong> says how well a
          candidate fits the sentence. It combines the neighborhood score and
          the language mixing score, each multiplied by its weight.
        </Explanation>
        <div className="space-y-2">
          {suggestions.map((item, position) => (
            <Row key={item.word} delay={position * 250}>
              <div className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate font-semibold text-emerald-700">
                  {item.word}
                </span>
                <Bar value={item.scores.dependency_compatibility} delay={position * 250 + 300} highlight />
                <span className="w-10 text-right text-xs font-medium text-slate-600">
                  {format(item.scores.dependency_compatibility)}
                </span>
              </div>
              <Formula>
                Sentence fit = {format(weights.dependency_neighborhood)} × {format(item.scores.dependency_neighborhood)} +{" "}
                {format(weights.cross_language)} × {format(item.scores.cross_language)} ={" "}
                {format(item.scores.dependency_compatibility)}
              </Formula>
            </Row>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <Explanation>
        The <strong>final candidate score</strong> combines spelling similarity
        and sentence fit, each multiplied by its weight. Candidates are listed
        from the highest score down. When scores are tied, the candidate with
        fewer edits comes first, then the one that comes first alphabetically.
      </Explanation>
      <div className="space-y-2">
        {suggestions.map((item, position) => (
          <Row
            key={item.word}
            delay={position * 250}
            className={position === 0 ? "border-[#e8d169] bg-[#f7f1c5]" : ""}
          >
            <div className="flex items-center gap-3">
              <span className="w-5 text-sm font-bold text-slate-700">{position + 1}</span>
              <span
                className={`w-32 shrink-0 truncate font-semibold ${position === 0 ? "text-emerald-700" : "text-slate-700"}`}
              >
                {item.word}
              </span>
              <Bar value={item.score} delay={position * 250 + 300} highlight={position === 0} />
              <span className="w-10 text-right text-xs font-medium text-slate-600">
                {format(item.score)}
              </span>
            </div>
            <Formula>
              Final score = {format(weights.edit_distance)} × {format(item.scores.edit_distance)} +{" "}
              {format(weights.dependency_compatibility)} × {format(item.scores.dependency_compatibility)} ={" "}
              {format(item.score)}
            </Formula>
          </Row>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {flagged ? `Best match for "${flagged.text}": ${suggestions[0].word}` : ""}
      </p>
    </div>
  );
}
