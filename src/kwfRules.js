const MANWAL = "KWF Manwal sa Masinop na Pagsulat";

// The hyphenation rules are the ones Ca-Spell applies (backend/error_detection/morphology.py, H1-H3).
const hyphenRules = {
  H1: {
    code: "H1",
    title: "Hyphen after a consonant-ending prefix before a vowel",
    text: "A prefix that ends in a consonant takes a hyphen when the word that follows starts with a vowel.",
    examples: "mag-aral, pag-ibig, mag-aaral",
    topic: "Paggamit ng gitling (hyphen)",
  },
  H2: {
    code: "H2",
    title: "Hyphen between an affix and an English root or a proper noun",
    text: "When an affix is attached to an English word (spelling kept) or a proper noun, a hyphen separates them.",
    examples: "nag-submit, magsu-submit, i-save, taga-Maynila",
    topic: "Paggamit ng gitling (hyphen) sa salitang hiram at pangngalang pantangi",
  },
  H3: {
    code: "H3",
    title: "No hyphen between an affix and a Tagalog root",
    text: "Any other hyphen between an affix and a Tagalog root is unnecessary, so the word is written solid.",
    examples: "nag-kain becomes nagkain",
    topic: "Paggamit ng gitling (hyphen)",
  },
};

const vowels = "aeiou";

function hyphenRuleFor(check) {
  const analysis = check?.analysis ?? {};
  const english = (analysis.root_languages ?? []).length === 1 && analysis.root_languages[0] === "english";
  const prefix = (analysis.prefix ?? "").toLowerCase();
  const afterPrefix = ((analysis.reduplication || analysis.root || "")[0] ?? "").toLowerCase();
  if (english) return hyphenRules.H2;
  if (prefix && !vowels.includes(prefix.at(-1)) && vowels.includes(afterPrefix)) return hyphenRules.H1;
  return hyphenRules.H3;
}

function spellingRule(check) {
  const affixed = check?.error_part === "root" || check?.error_part === "affix";
  if (affixed) {
    return {
      code: "Affixation",
      title: "An affixed word is checked as affix + root",
      text:
        check.error_part === "root"
          ? "The affix is valid, so the root must be a correctly spelled English or Tagalog word."
          : "The root is valid, so the affix must be one of the Taglish prefixes (for example nag-, mag-, pag-).",
      examples: "nag-submit, magsu-submit, nakapag-aral",
      reference: MANWAL,
      topic: "Panlapi (affixes) at pag-uulit (reduplication)",
    };
  }
  return {
    code: "Spelling",
    title: "Spell the word as it appears in the standard word lists",
    text: "A word is correct when it is in the English or Tagalog word list.",
    examples: "",
    reference: "KWF Diksiyonaryo ng Wikang Filipino and the Ortograpiyang Pambansa",
    topic: "Ispeling (spelling)",
  };
}

const contextRule = {
  code: "Verb aspect",
  title: "The verb's aspect must agree with the time word",
  text: "nag- marks a completed action (past) and mag- a contemplated action (future). A completed action cannot go with a future time word such as bukas, and a future action cannot go with kahapon.",
  examples: "Nag-submit ako kahapon. / Mag-submit ako bukas.",
  reference: "Tables 3 and 4 of this study",
  topic: "Check the verb's aspect (aspekto ng pandiwa) in a Tagalog grammar reference",
};

const reasonLabels = {
  spelling: "Misspelled word",
  hyphenation: "Hyphen placed incorrectly",
  context: "Verb tense and time word do not agree",
};

// What to show when a corrected word is hovered: why it was flagged and the rule to verify it against.
export function describeCorrection(edit) {
  const check = edit.token?.check;
  const reasons = edit.reasons ?? [];
  const rules = [];
  if (reasons.includes("hyphenation") || check?.error_type === "hyphenation") {
    const rule = hyphenRuleFor(check);
    rules.push({ ...rule, reference: MANWAL });
  } else if (reasons.includes("spelling") || (check && !check.valid)) {
    rules.push(spellingRule(check));
  }
  if (reasons.includes("context")) {
    rules.push(contextRule);
  }
  return {
    why: reasons.map((reason) => reasonLabels[reason] ?? reason).join(" and ") || "Flagged by Ca-Spell",
    rules,
  };
}
