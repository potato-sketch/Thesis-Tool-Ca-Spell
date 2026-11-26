const MANWAL = "KWF Manwal sa Masinop na Pagsulat";

// The hyphenation rules are the ones Ca-Spell applies (backend/error_detection/morphology.py, H1-H5),
// with the section of the Manwal each comes from.
const hyphenRules = {
  H1: {
    code: "H1",
    title: "Hyphen after a consonant-ending prefix before a vowel",
    text: "A prefix that ends in a consonant takes a hyphen when the word that follows starts with a vowel.",
    examples: "mag-aral, pag-isa, pang-ulo",
    topic: "11.3 Sa Paghihiwalay ng Katinig at Patinig",
  },
  H2: {
    code: "H2",
    title: "Hyphen between an affix and a foreign word or a proper noun",
    text:
      "When an affix is attached to a foreign word in its original spelling or to a proper noun, a hyphen separates them, even after a prefix ending in a vowel. A repeated syllable is written as it sounds and stays with the prefix.",
    examples: "nag-submit, pa-cute, maki-computer, ipako-close, taga-Itogon, naka-Gucci",
    topic: "11.3 Sa Paghihiwalay ng Katinig at Patinig; 12.40 Gitling; 2.3 Pantig na Inuulit",
  },
  H3: {
    code: "H3",
    title: "No hyphen between an affix and a Tagalog root",
    text:
      "Any other hyphen between an affix and a Tagalog or respelled root is unnecessary, so the word is written solid.",
    examples: "nag-kain becomes nagkain; pakyut, makikompiyuter",
    topic: "11.3 Sa Paghihiwalay ng Katinig at Patinig",
  },
  H4: {
    code: "H4",
    title: "Hyphen only in a repeated word",
    text:
      "A repeated word takes a hyphen, but a contraction such as iba't (iba at) is not a repeated word, so it takes a space instead.",
    examples: "araw-araw, pali-palito, pabalik-balik; iba't-iba becomes iba't iba",
    topic: "11.1 Sa Inuulit na Salita",
  },
  H5: {
    code: "H5",
    title: "Hyphen after de-, di- and kontra-",
    text: "Words formed with de- (made or used by), di- (idiomatic not) and kontra- always take a hyphen.",
    examples: "de-lata, di-mahipo, kontra-Marxismo",
    topic: "11.9 Sa Kasunod ng De; 11.10 Sa Kasunod ng Di; 12.40 Gitling",
  },
};

const vowels = "aeiou";

function hyphenRuleFor(check) {
  const analysis = check?.analysis ?? {};
  if (hyphenRules[analysis.kwf_rule]) return hyphenRules[analysis.kwf_rule];
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
