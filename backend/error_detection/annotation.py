"""ERROR DETECTION MODULE: Context-Aware Linguistic Annotation.

Adds aspect (verbs) and temporal (time expressions) annotations on top of the
POS tags from the Preprocessing Module (Table 3).
"""

from error_detection.morphology import readings
from preprocessing.lexicon import normalize

# Table 3. Aspect annotation (verbs): verb prefix -> annotated POS.
VERB_PREFIX_ANNOTATIONS = {
    "nag": "VERB-PAST",
    "mag": "VERB-FUTURE",
}

# Table 3. Temporal annotation (time expressions, POS = ADV) -> annotated POS.
TEMPORAL_ANNOTATIONS = {
    "kahapon": "ADV-PAST",
    "kanina": "ADV-PAST",
    "ngayon": "ADV-PRESENT",
    "mamaya": "ADV-FUTURE",
    "bukas": "ADV-FUTURE",
}

# Extension beyond Table 3: verbs without a nag-/mag- prefix ("kumain", "kakain",
# "na-stress") use the aspect CalamanCy's morphologizer predicts.
USE_CALAMANCY_ASPECT = True


def annotate(token, lexicon):
    """Returns {"annotation", "trigger"} for verbs and time words, else None."""
    word = normalize(token.text)

    if token.pos_ == "VERB":
        prefix = verb_prefix(word, lexicon)
        if prefix in VERB_PREFIX_ANNOTATIONS:
            return {"annotation": VERB_PREFIX_ANNOTATIONS[prefix], "trigger": f"prefix {prefix}-"}
        if USE_CALAMANCY_ASPECT:
            annotation = _annotation_from_aspect(token)
            if annotation:
                return {"annotation": annotation, "trigger": f"Aspect={token.morph.get('Aspect')[0]}"}

    # "bukas" as ADV is "tomorrow"; as an adjective/noun it means "open".
    if token.pos_ == "ADV" and word in TEMPORAL_ANNOTATIONS:
        return {"annotation": TEMPORAL_ANNOTATIONS[word], "trigger": word}

    return None


def verb_prefix(word, lexicon):
    """The verb's prefix according to its affix analysis, so "maganda" reads as
    ma- + ganda rather than mag- + anda. The reading with the longest known root
    wins; words with an unknown root fall back to their first letters."""
    candidates = list(readings(word, lexicon.lookup))
    if candidates:
        return max(candidates, key=lambda reading: len(reading.root)).prefix
    for prefix in VERB_PREFIX_ANNOTATIONS:
        if word.startswith(prefix):
            return prefix
    return None


def _annotation_from_aspect(token):
    aspect = token.morph.get("Aspect")
    mood = token.morph.get("Mood")
    if aspect == ["Perf"]:
        return "VERB-PAST"  # completed: kumain, kinain, nag-submit
    if aspect == ["Prosp"] or (aspect == ["Imp"] and mood == ["Pot"]):
        return "VERB-FUTURE"  # contemplated: kakain, magsu-submit
    if aspect == ["Imp"]:
        return "VERB-PRESENT"  # progressive: kumakain, nagdo-download
    return None
