import {
  describeLanguages,
  hasGapBefore,
  reasonLabels,
} from "./analysisLabels";

const TABLE_3 = [
  { trigger: "Prefix nag-", match: "prefix nag-", from: "VERB", to: "VERB-PAST" },
  { trigger: "Prefix mag-", match: "prefix mag-", from: "VERB", to: "VERB-FUTURE" },
  { trigger: "kahapon", match: "kahapon", from: "ADV", to: "ADV-PAST" },
  { trigger: "kanina", match: "kanina", from: "ADV", to: "ADV-PAST" },
  { trigger: "ngayon", match: "ngayon", from: "ADV", to: "ADV-PRESENT" },
  { trigger: "mamaya", match: "mamaya", from: "ADV", to: "ADV-FUTURE" },
  { trigger: "bukas", match: "bukas", from: "ADV", to: "ADV-FUTURE" },
];

const TABLE_4 = [
  { verb: "VERB-PAST", time: "ADV-PAST", compatible: true },
  { verb: "VERB-PAST", time: "ADV-FUTURE", compatible: false },
  { verb: "VERB-FUTURE", time: "ADV-FUTURE", compatible: true },
  { verb: "VERB-FUTURE", time: "ADV-PAST", compatible: false },
];

const methodLabels = {
  hyphen_splitting: "Hyphen-based splitting",
  affix_boundary: "Affix boundary detection",
  compound: "Compound word",
  dictionary: "Linker or contraction",
};

const aspectMeaning = {
  "VERB-PAST": "completed action",
  "VERB-FUTURE": "contemplated action",
  "VERB-PRESENT": "ongoing action",
  "ADV-PAST": "past time",
  "ADV-PRESENT": "present time",
  "ADV-FUTURE": "future time",
};

function Lead({ children }) {
  return <p className="mb-3 text-sm font-medium text-slate-800">{children}</p>;
}

function Empty({ children }) {
  return (
    <p className="walk-rise rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
      {children}
    </p>
  );
}

function Chip({ children, tone = "plain", delay = 0 }) {
  const tones = {
    plain: "border-slate-300 bg-white text-slate-900",
    good: "border-emerald-300 bg-emerald-50 text-emerald-800",
    warn: "border-amber-300 bg-amber-50 text-amber-800",
    bad: "border-red-400 bg-red-50 text-red-700",
    muted: "border-slate-200 bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`walk-pop inline-block rounded-lg border px-2.5 py-1 text-sm font-semibold ${tones[tone]}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </span>
  );
}

function Segment({ label, text, tone, delay, languages }) {
  return (
    <span className="walk-pop inline-flex flex-col items-center" style={{ animationDelay: `${delay}ms` }}>
      <span
        className={`rounded-lg border px-2.5 py-1 font-mono text-sm font-semibold ${
          tone === "bad" ? "border-red-400 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-900"
        }`}
      >
        {text}
      </span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
        {languages?.length ? ` · ${describeLanguages(languages)}` : ""}
      </span>
    </span>
  );
}

function segmentsOf(token) {
  const { check } = token;
  const a = check.analysis ?? {};
  const bad = (part) => (!check.valid && check.error_part === part) || (!check.valid && check.error_part === "word");
  const segments = [];
  if (a.parts) {
    a.parts.forEach((part) => segments.push({ label: "part", text: part }));
  } else if (a.base) {
    segments.push({ label: "base word", text: a.base }, { label: "linker", text: a.linker });
  } else {
    if (a.prefix || (!check.valid && a.affix)) {
      segments.push({ label: "affix", text: a.prefix || a.affix, tone: bad("affix") ? "bad" : undefined });
    }
    if (a.infix) segments.push({ label: "infix", text: a.infix });
    if (a.reduplication) segments.push({ label: "repeated syllable", text: a.reduplication });
    if (a.root) {
      segments.push({
        label: "root",
        text: a.root,
        languages: a.root_languages,
        tone: bad("root") ? "bad" : undefined,
      });
    }
    if (a.suffix) segments.push({ label: "suffix", text: a.suffix });
  }
  if (segments.length === 0) segments.push({ label: "word", text: token.text, tone: check.valid ? undefined : "bad" });
  return segments;
}

function governingVerb(token, byIndex) {
  let current = token;
  while (current.head_index !== current.index) {
    current = byIndex.get(current.head_index);
    if (!current) return null;
    if (current.annotation?.annotation.startsWith("VERB")) return current;
  }
  return null;
}

export default function DetectionStage({ stepKey, tokens, errors }) {
  const errorByIndex = new Map(errors.map((error) => [error.index, error]));
  const byIndex = new Map(tokens.map((token) => [token.index, token]));

  if (stepKey === "dictionary") {
    const checkable = tokens.filter((token) => token.check !== null);
    const found = checkable.filter((token) => token.languages.length > 0);
    return (
      <div>
        <Lead>
          Is each word in the English or Tagalog word list? Found words are correctly spelled and skip the remaining
          spelling checks.
        </Lead>
        <div className="flex flex-wrap gap-x-3 gap-y-4">
          {tokens.map((token, position) => {
            const delay = position * 200;
            if (token.check === null) {
              return (
                <div key={token.index} className="flex flex-col items-center gap-1">
                  <Chip tone="muted" delay={delay}>{token.text}</Chip>
                  <span className="walk-rise text-[10px] text-slate-500" style={{ animationDelay: `${delay + 250}ms` }}>
                    not spell-checked
                  </span>
                </div>
              );
            }
            const inList = token.languages.length > 0;
            return (
              <div key={token.index} className="flex max-w-40 flex-col items-center gap-1">
                <Chip tone={inList ? "good" : "warn"} delay={delay}>
                  {inList ? "✓" : "?"} {token.text}
                </Chip>
                <span
                  className={`walk-rise text-center text-[10px] ${inList ? "text-emerald-700" : "text-amber-700"}`}
                  style={{ animationDelay: `${delay + 250}ms` }}
                >
                  {inList ? `found: ${describeLanguages(token.languages)}` : "not in the word lists, check next"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="walk-rise mt-4 text-xs text-slate-600" style={{ animationDelay: `${tokens.length * 200 + 300}ms` }}>
          {found.length} of {checkable.length} words were found. {checkable.length - found.length} continue to the
          next check.
        </p>
      </div>
    );
  }

  if (stepKey === "codeswitch") {
    const pending = tokens.filter((token) => token.check !== null && token.languages.length === 0);
    return (
      <div>
        <Lead>
          Words missing from the lists are split into affixes and a root, to see whether they are legitimate Taglish
          or compound words.
        </Lead>
        {pending.length === 0 ? (
          <Empty>Every word was found in the word lists, so this check had nothing to do.</Empty>
        ) : (
          <div className="space-y-3">
            {pending.map((token, position) => {
              const { check } = token;
              const base = position * 1200;
              const segments = segmentsOf(token);
              return (
                <div
                  key={token.index}
                  className="walk-rise rounded-lg border border-slate-200 bg-white p-3"
                  style={{ animationDelay: `${base}ms` }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{token.text}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {methodLabels[check.method] ?? check.method}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {segments.map((segment, index) => (
                      <Segment key={index} {...segment} delay={base + 300 + index * 250} />
                    ))}
                  </div>
                  <p
                    className={`walk-rise mt-2 text-sm font-semibold ${check.valid ? "text-emerald-700" : "text-red-700"}`}
                    style={{ animationDelay: `${base + 300 + segments.length * 250 + 200}ms` }}
                  >
                    {check.valid
                      ? "✓ A legitimate Taglish word"
                      : check.error_type === "hyphenation"
                        ? `✕ Hyphenation error: it should be "${check.expected}"`
                        : `✕ Spelling error in the ${check.error_part === "word" ? "word" : check.error_part}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (stepKey === "annotation") {
    const annotated = tokens.filter((token) => token.annotation);
    const matchedRows = new Set(
      annotated
        .map((token) => TABLE_3.find((row) => row.match === token.annotation.trigger || row.match === token.text.toLowerCase()))
        .filter(Boolean)
        .map((row) => row.trigger),
    );
    return (
      <div>
        <Lead>
          Verbs get an aspect label from their prefix, and time words get a time label. These labels go beyond the
          plain POS tag.
        </Lead>
        <div className="grid gap-4 md:grid-cols-2">
          <table className="walk-rise w-full self-start text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-1.5">Trigger</th>
                <th className="p-1.5">Original POS</th>
                <th className="p-1.5">Annotated POS</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_3.map((row) => (
                <tr key={row.trigger} className={matchedRows.has(row.trigger) ? "bg-emerald-100 font-semibold" : "text-slate-500"}>
                  <td className="p-1.5">{row.trigger}</td>
                  <td className="p-1.5">{row.from}</td>
                  <td className="p-1.5">{row.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-2">
            {annotated.length === 0 ? (
              <Empty>No verb prefix or time word here, so nothing is annotated.</Empty>
            ) : (
              annotated.map((token, position) => (
                <div
                  key={token.index}
                  className="walk-rise rounded-lg border border-slate-200 bg-white p-2 text-sm"
                  style={{ animationDelay: `${600 + position * 600}ms` }}
                >
                  <span className="font-semibold">{token.text}</span>
                  <span className="mx-1.5 text-slate-400">→</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-800">
                    {token.annotation.annotation}
                  </span>
                  <p className="mt-1 text-xs text-slate-600">
                    {aspectMeaning[token.annotation.annotation] ?? ""} (trigger: {token.annotation.trigger})
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (stepKey === "compatibility") {
    const pairs = tokens
      .filter((token) => token.annotation?.annotation.startsWith("ADV"))
      .map((time) => ({ time, verb: governingVerb(time, byIndex) }))
      .filter((pair) => pair.verb)
      .map((pair) => ({
        ...pair,
        rule: TABLE_4.find(
          (row) => row.verb === pair.verb.annotation.annotation && row.time === pair.time.annotation.annotation,
        ),
      }));
    const usedRows = new Set(pairs.filter((pair) => pair.rule).map((pair) => `${pair.rule.verb}|${pair.rule.time}`));
    return (
      <div>
        <Lead>Can the verb's aspect and the time word it is connected to be true at the same time?</Lead>
        <div className="grid gap-4 md:grid-cols-2">
          <table className="walk-rise w-full self-start text-left text-xs">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-1.5">Verb</th>
                <th className="p-1.5">Time word</th>
                <th className="p-1.5">Result</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_4.map((row) => (
                <tr
                  key={`${row.verb}|${row.time}`}
                  className={usedRows.has(`${row.verb}|${row.time}`) ? (row.compatible ? "bg-emerald-100 font-semibold" : "bg-red-100 font-semibold") : "text-slate-500"}
                >
                  <td className="p-1.5">{row.verb}</td>
                  <td className="p-1.5">{row.time}</td>
                  <td className="p-1.5">{row.compatible ? "Compatible" : "Incompatible"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-2">
            {pairs.length === 0 ? (
              <Empty>No verb is paired with a time word, so there is nothing to compare.</Empty>
            ) : (
              pairs.map(({ verb, time, rule }, position) => (
                <div
                  key={`${verb.index}-${time.index}`}
                  className="walk-rise rounded-lg border border-slate-200 bg-white p-2 text-sm"
                  style={{ animationDelay: `${600 + position * 700}ms` }}
                >
                  <span className="font-semibold">{verb.text}</span>{" "}
                  <span className="font-mono text-xs text-slate-600">({verb.annotation.annotation})</span>
                  <span className="mx-1.5 text-slate-400">+</span>
                  <span className="font-semibold">{time.text}</span>{" "}
                  <span className="font-mono text-xs text-slate-600">({time.annotation.annotation})</span>
                  <p
                    className={`mt-1 text-xs font-semibold ${!rule ? "text-slate-500" : rule.compatible ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {!rule
                      ? "Not judged by Table 4"
                      : rule.compatible
                        ? "✓ Compatible"
                        : `✕ Incompatible: ${verb.text} is marked as a context error`}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  const flagged = tokens.filter((token) => errorByIndex.has(token.index));
  return (
    <div>
      <Lead>
        Words that failed the dictionary lookup, the code-switching and compound check, or the context check become
        error candidates and go to the Error Correction Module.
      </Lead>
      <p className="mb-3 text-xl leading-relaxed text-slate-900">
        {tokens.map((token, position) => {
          const error = errorByIndex.get(token.index);
          return (
            <span key={token.index}>
              {hasGapBefore(tokens, position) ? " " : ""}
              <span
                className={`walk-pop inline-block rounded px-1 ${error ? "bg-red-100 font-semibold text-red-700" : ""}`}
                style={{ animationDelay: `${position * 140}ms` }}
              >
                {token.text}
              </span>
            </span>
          );
        })}
      </p>
      {flagged.length === 0 ? (
        <Empty>No errors found, so nothing is forwarded.</Empty>
      ) : (
        <div className="space-y-2">
          {flagged.map((token, position) => (
            <div
              key={token.index}
              className="walk-rise flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm"
              style={{ animationDelay: `${tokens.length * 140 + position * 400}ms` }}
            >
              <span className="font-semibold text-red-700">✕ {token.text}</span>
              <span className="text-red-800">
                {(errorByIndex.get(token.index).reasons ?? []).map((reason) => reasonLabels[reason] ?? reason).join(" and ")}
              </span>
              <span className="text-slate-500">→ forwarded to the Error Correction Module</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
