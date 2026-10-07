const partsOfSpeech = {
  ADJ: ["Adjective", "describes a noun, such as 'maganda' or 'big'"],
  ADP: ["Preposition", "links a noun to the rest of the sentence, such as 'sa' or 'in'"],
  ADV: ["Adverb", "tells how, when, or where something happens, such as 'bukas' or 'quickly'"],
  AUX: ["Helper verb", "supports the main verb, such as 'is' or 'will'"],
  CCONJ: ["Joining word", "connects words or phrases, such as 'at' or 'and'"],
  DET: ["Determiner", "introduces a noun, such as 'ang' or 'the'"],
  INTJ: ["Interjection", "an exclamation, such as 'oh' or 'wow'"],
  NOUN: ["Noun", "names a person, place, thing, or idea"],
  NUM: ["Number", "expresses a quantity, such as 'dalawa' or 'two'"],
  PART: ["Particle", "a small word that adds meaning, such as 'na', 'po', or 'ba'"],
  PRON: ["Pronoun", "stands in for a noun, such as 'ako' or 'she'"],
  PROPN: ["Proper noun", "the name of a specific person, place, or thing"],
  PUNCT: ["Punctuation", "a mark such as a period or a comma"],
  SCONJ: ["Clause-joining word", "introduces a smaller clause, such as 'kasi' or 'because'"],
  SYM: ["Symbol", "a character such as $ or %"],
  VERB: ["Verb", "describes an action or a state"],
  X: ["Other", "a word the analyzer could not classify"],
};

const relationships = {
  root: ["Main word", "the word the whole sentence is built around"],
  nsubj: ["Subject", "who or what performs the action"],
  csubj: ["Clause as subject", "a whole clause that acts as the subject"],
  obj: ["Object", "who or what receives the action"],
  iobj: ["Indirect object", "who benefits from or receives the object"],
  obl: ["Extra detail", "adds information such as where, when, or how"],
  nmod: ["Noun detail", "describes or relates to another noun"],
  amod: ["Adjective for a noun", "describes the noun it is attached to"],
  advmod: ["Adverb detail", "tells how, when, or where something happens"],
  det: ["Determiner", "introduces the noun it is attached to"],
  case: ["Linking word", "links a noun to the rest of the sentence, such as 'ng' or 'sa'"],
  mark: ["Clause opener", "introduces a smaller clause, such as 'kasi' or 'that'"],
  cc: ["Joining word", "connects two similar words or phrases"],
  conj: ["Joined item", "connected to another word by a joining word"],
  aux: ["Helper verb", "supports the main verb"],
  cop: ["Linking verb", "connects a subject to a description, such as 'is'"],
  compound: ["Compound part", "forms one idea together with the word next to it"],
  flat: ["Name part", "part of a name or a multi-word phrase"],
  fixed: ["Fixed phrase part", "part of an expression that always stays together"],
  punct: ["Punctuation", "a mark attached to the word it follows"],
  acl: ["Clause describing a noun", "a clause that gives more detail about a noun"],
  advcl: ["Clause describing an action", "a clause that tells why, when, or under what condition"],
  ccomp: ["Completing clause", "a clause that completes the meaning of a verb"],
  xcomp: ["Completing phrase", "a phrase that completes the meaning of a verb"],
  appos: ["Renaming phrase", "renames or explains the noun beside it"],
  nummod: ["Number detail", "gives the quantity of a noun"],
  parataxis: ["Side sentence", "a separate statement placed beside the main one"],
  discourse: ["Conversation word", "a word that adds tone, such as 'po' or 'oh'"],
  vocative: ["Person addressed", "the person being spoken to"],
  expl: ["Placeholder word", "fills a grammatical position without adding meaning"],
  orphan: ["Leftover part", "a part left over when a word is omitted"],
  dep: ["Unspecified link", "the analyzer could not decide how this word connects"],
};

const languageNames = { english: "English", tagalog: "Tagalog" };

export const reasonLabels = {
  spelling: "Misspelled word",
  hyphenation: "Hyphen placed incorrectly",
  context: "Verb tense and time word do not agree",
};

export function describePartOfSpeech(tag) {
  return partsOfSpeech[tag] ?? [tag ? tag : "Unknown", ""];
}

export function describeRelationship(relation) {
  const key = (relation ?? "").toLowerCase();
  return (
    relationships[key] ??
    relationships[key.split(":")[0]] ?? [key || "Unknown", ""]
  );
}

export function describeLanguages(languages = []) {
  if (languages.length === 0) return "Not found in word lists";
  return languages.map((language) => languageNames[language] ?? language).join(" and ");
}

const nouns = ["NOUN", "PROPN", "PRON"];
const modifiers = ["ADJ", "ADV"];
const smallWords = ["ADP", "DET", "PART", "CCONJ", "SCONJ", "AUX", "PUNCT", "SYM"];

export function partOfSpeechColor(tag) {
  if (tag === "VERB") return "bg-emerald-100 text-emerald-800";
  if (nouns.includes(tag)) return "bg-sky-100 text-sky-800";
  if (modifiers.includes(tag)) return "bg-amber-100 text-amber-800";
  if (smallWords.includes(tag)) return "bg-slate-200 text-slate-700";
  return "bg-violet-100 text-violet-800";
}

export function buildTree(tokens) {
  const nodes = new Map(
    tokens.map((token) => [token.index, { token, children: [] }]),
  );
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.token.head_index);
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// A space goes wherever the original text had one between two tokens.
export function hasGapBefore(tokens, position) {
  return position > 0 && tokens[position].start > tokens[position - 1].end;
}
