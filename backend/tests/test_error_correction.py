import math
import sys
import tempfile
import unittest
from pathlib import Path

from spacy.tokens import Doc
from spacy.vocab import Vocab

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from error_correction.candidate_generation import generate_candidates  # noqa: E402
from error_correction.corrector import correct_errors  # noqa: E402
from error_correction.edit_distance import edit_distance, search  # noqa: E402
from error_correction.final_scoring import edit_distance_score, effective_weights, final_candidate_score  # noqa: E402
from error_correction.frequency_profile import FrequencyProfile, annotated_tags, pos_windows  # noqa: E402
from error_correction.context_scoring import context_score  # noqa: E402
from error_detection.detector import detect_errors  # noqa: E402
from preprocessing.automaton import WordAutomaton  # noqa: E402
from preprocessing.lexicon import normalize  # noqa: E402
from ta_wdca.cldc import cross_language_compatibility, language_label  # noqa: E402
from ta_wdca.dcs import dependency_compatibility  # noqa: E402
from ta_wdca.dna import dependency_neighborhood  # noqa: E402

ENGLISH = {"submit", "assignment", "assignments", "assault", "download", "project", "stress", "comment", "at"}
TAGALOG = {"ako", "ng", "ang", "bukas", "kain", "aral", "nag", "kahapon", "mamaya", "sa", "ganda"}


class FakeLexicon:
    def __init__(self):
        self.automata = {
            "english": WordAutomaton.from_words(ENGLISH),
            "tagalog": WordAutomaton.from_words(TAGALOG),
        }

    def lookup(self, word):
        word = normalize(word)
        return [language for language, automaton in self.automata.items() if word in automaton]


LEXICON = FakeLexicon()


def parse(words, pos, heads, deps):
    return Doc(Vocab(), words=words, pos=pos, heads=heads, deps=deps, morphs=[""] * len(words))


def brute_force(words, target, max_distance):
    return {w: edit_distance(w, target) for w in words if edit_distance(w, target) <= max_distance}


class EditDistanceTest(unittest.TestCase):
    def test_edit_distance(self):
        self.assertEqual(edit_distance("kitten", "sitting"), 3)
        self.assertEqual(edit_distance("assignmnt", "assignment"), 1)
        self.assertEqual(edit_distance("", "abc", band=None), 3)

    def test_banded_edit_distance(self):
        self.assertEqual(edit_distance("kitten", "kitten"), 0)
        self.assertEqual(edit_distance("bukas", "bukaz"), 1)
        self.assertEqual(edit_distance("stress", "stres"), 1)
        self.assertEqual(edit_distance("submit", "sbmt"), 2)
        # Length gap wider than the band is infinity.
        self.assertEqual(edit_distance("", "abc"), math.inf)
        self.assertEqual(edit_distance("abcdef", "ab"), math.inf)
        self.assertEqual(edit_distance("abc", "xyz"), 3)

    def test_banded_matches_full_within_threshold(self):
        words = ["submit", "sbmit", "assignment", "assignmnt", "bukas", "bukaz", "kain", "kan", "nag", "stress", "stres", "umbit"]
        for a in words:
            for b in words:
                full = edit_distance(a, b, band=None)
                banded = edit_distance(a, b)
                if full <= 2:
                    self.assertEqual(banded, full, (a, b))
                else:
                    self.assertGreater(banded, 2, (a, b))

    def test_automaton_search_matches_brute_force(self):
        words = ENGLISH | TAGALOG | {"submitt", "submi", "sbmit", "umbit"}
        automaton = WordAutomaton.from_words(words)
        for target in ["submit", "assignmnt", "bukaz", "nag", "xyz", "stres", "kain"]:
            for k in (0, 1, 2):
                self.assertEqual(search(automaton, target, k), brute_force(words, target, k), (target, k))

    def test_short_words_allow_one_edit(self):
        automaton = WordAutomaton.from_words(["ang", "ng", "sa", "ako"])
        self.assertEqual(search(automaton, "an"), {"ang": 1})


class CandidateGenerationTest(unittest.TestCase):
    def test_collects_candidates_from_both_word_lists(self):
        candidates = {c.word: c for c in generate_candidates("assignmnt", LEXICON.automata)}
        self.assertEqual(candidates["assignment"].distance, 1)
        self.assertEqual(candidates["assignment"].languages, ("english",))
        self.assertNotIn("submit", candidates)

    def test_closest_candidates_come_first(self):
        candidates = generate_candidates("assignmnt", LEXICON.automata)
        self.assertEqual(candidates[0].word, "assignment")
        self.assertEqual([c.distance for c in candidates], sorted(c.distance for c in candidates))

    def test_limit(self):
        self.assertEqual(len(generate_candidates("assignmnt", LEXICON.automata, limit=1)), 1)


class FinalScoringTest(unittest.TestCase):
    def test_edit_distance_score(self):
        self.assertEqual(edit_distance_score(0), 1)
        self.assertGreater(edit_distance_score(1), edit_distance_score(2))
        self.assertGreater(edit_distance_score(2), 0)

    def test_final_candidate_score_without_a_corpus_uses_scaled_weights(self):
        self.assertAlmostEqual(sum(effective_weights(False)), 1.0)
        self.assertAlmostEqual(final_candidate_score(1, 0), effective_weights(False)[0])
        self.assertAlmostEqual(final_candidate_score(0, 1), effective_weights(False)[1])

    def test_final_candidate_score_with_context_score_is_weighted_sum(self):
        w1, w2, w3 = effective_weights(True)
        self.assertAlmostEqual(w1 + w2 + w3, 1.0)
        self.assertAlmostEqual(final_candidate_score(1, 0, 0), w1)
        self.assertAlmostEqual(final_candidate_score(0, 1, 0), w2)
        self.assertAlmostEqual(final_candidate_score(0, 0, 1), w3)


SENTENCE = ["Nag-submit", "ako", "ng", "assignment", "bukas"]
POS = ["VERB", "PRON", "ADP", "NOUN", "ADV"]
HEADS = [0, 0, 3, 0, 0]
DEPS = ["ROOT", "nsubj", "case", "obj", "advmod"]


class TAWDCATest(unittest.TestCase):
    def test_same_neighborhood_scores_one(self):
        original = parse(SENTENCE, POS, HEADS, DEPS)[3]
        candidate = parse(SENTENCE, POS, HEADS, DEPS)[3]
        self.assertEqual(dependency_neighborhood(original, candidate, LEXICON)["score"], 1.0)

    def test_implausible_role_lowers_dna(self):
        original = parse(SENTENCE, POS, HEADS, DEPS)[3]
        # An adverb as the object of a verb, attached to a different word.
        other = parse(SENTENCE, ["VERB", "PRON", "ADP", "ADV", "ADV"], [0, 0, 3, 4, 4], DEPS)[3]
        result = dependency_neighborhood(original, other, LEXICON)
        self.assertEqual((result["pos"], result["head"]), (0, 0))
        self.assertLess(result["score"], 1.0)

    def test_second_object_of_the_same_head_fails_rel(self):
        doc = parse(["kain", "ako", "assignment", "bukas"], ["VERB", "PRON", "NOUN", "NOUN"], [0, 0, 0, 0],
                    ["ROOT", "nsubj", "obj", "obj"])
        self.assertEqual(dependency_neighborhood(doc[2], doc[2], LEXICON)["rel"], 0)

    def test_time_word_that_contradicts_the_verb_fails_rel(self):
        past = parse(["Nag-submit", "ako", "kahapon"], ["VERB", "PRON", "ADV"], [0, 0, 0], ["ROOT", "nsubj", "advmod"])
        future = parse(["Nag-submit", "ako", "bukas"], ["VERB", "PRON", "ADV"], [0, 0, 0], ["ROOT", "nsubj", "advmod"])
        self.assertEqual(dependency_neighborhood(past[2], past[2], LEXICON)["rel"], 1)
        self.assertEqual(dependency_neighborhood(past[2], future[2], LEXICON)["rel"], 0)

    def test_language_labels(self):
        self.assertEqual(language_label("assignment", LEXICON), "english")
        self.assertEqual(language_label("ako", LEXICON), "tagalog")
        self.assertEqual(language_label(".", LEXICON), "unknown")

    def test_supported_cross_language_relation(self):
        # English object of an affixed English verb: "ako" (tagalog) is the subject, "assignment" the object.
        token = parse(SENTENCE, POS, HEADS, DEPS)[3]
        result = cross_language_compatibility(token, LEXICON)
        self.assertEqual(result["score"], 1.0)

    def test_unsupported_cross_language_relation(self):
        # An English noun that is a "punct" dependent of a Tagalog pronoun is not a supported pair.
        doc = parse(["ako", "assignment"], ["PRON", "NOUN"], [0, 0], ["ROOT", "punct"])
        result = cross_language_compatibility(doc[1], LEXICON)
        self.assertEqual((result["valid"], result["total"], result["score"]), (0, 1, 0.0))

    def test_no_cross_language_relation_scores_one(self):
        doc = parse(["ako", "bukas"], ["PRON", "ADV"], [0, 0], ["ROOT", "advmod"])
        self.assertEqual(cross_language_compatibility(doc[1], LEXICON)["score"], 1.0)

    def test_dcs_combines_dna_and_cldc(self):
        token = parse(SENTENCE, POS, HEADS, DEPS)[3]
        result = dependency_compatibility(token, token, LEXICON, 0.5, 0.5)
        self.assertAlmostEqual(result["dcs"], 1.0)


class FrequencyProfileTest(unittest.TestCase):
    def test_annotated_tags_use_table_3(self):
        doc = parse(SENTENCE, POS, HEADS, DEPS)
        self.assertEqual(annotated_tags(doc, LEXICON), ["VERB-PAST", "PRON", "ADP", "NOUN", "ADV-FUTURE"])

    def test_windows_covering_a_token(self):
        tags = ["A", "B", "C", "D"]
        self.assertEqual(len(pos_windows(tags)), 4)
        self.assertEqual(pos_windows(tags, 0), [["<s>", "A", "B"], ["A", "B", "C"]])
        self.assertEqual(len(pos_windows(tags, 2)), 3)
        self.assertEqual(pos_windows(tags, 3), [["B", "C", "D"], ["C", "D", "</s>"]])

    def test_counts_and_round_trip(self):
        profile = FrequencyProfile()
        profile.add_sentence(parse(SENTENCE, POS, HEADS, DEPS), LEXICON)
        profile.add_sentence(parse(SENTENCE, POS, HEADS, DEPS), LEXICON)
        self.assertEqual(profile.sentences, 2)
        self.assertEqual(profile.pos_patterns["ADP NOUN ADV-FUTURE"], 2)
        self.assertEqual(profile.dependency_patterns["<root>|root|VERB-PAST"], 2)
        self.assertEqual(profile.dependency_patterns["VERB-PAST|obj|NOUN"], 2)

        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "profile.json"
            profile.save(path)
            loaded = FrequencyProfile.load(path)
            self.assertEqual(loaded.pos_patterns, profile.pos_patterns)
            self.assertEqual(loaded.dependency_patterns, profile.dependency_patterns)
            self.assertIsNone(FrequencyProfile.load(Path(folder) / "missing.json"))


class ContextScoreTest(unittest.TestCase):
    def setUp(self):
        self.profile = FrequencyProfile()
        self.profile.add_sentence(parse(SENTENCE, POS, HEADS, DEPS), LEXICON)

    def test_candidate_matching_the_corpus_scores_one(self):
        token = parse(SENTENCE, POS, HEADS, DEPS)[3]
        result = context_score(token, self.profile, LEXICON)
        self.assertEqual((result["pas"], result["uds"], result["cs"]), (1.0, 1.0, 1.0))
        self.assertEqual(len(result["pos_rules"]), 3)
        self.assertEqual(len(result["dependency_rules"]), 2)

    def test_unseen_patterns_lower_the_scores(self):
        doc = parse(SENTENCE, ["VERB", "PRON", "ADP", "ADJ", "ADV"], HEADS, ["ROOT", "nsubj", "case", "amod", "advmod"])
        result = context_score(doc[3], self.profile, LEXICON)
        self.assertLess(result["pas"], 1.0)
        self.assertEqual(result["uds"], 0.0)
        self.assertAlmostEqual(result["cs"], 0.5 * result["pas"])


class CorrectorTest(unittest.TestCase):
    def fake_parse_many(self, texts):
        """Parses "<verb> ako ng <noun> bukas": a noun in the object slot, anything else as an adjective."""
        docs = []
        for text in texts:
            noun = text.split()[3]
            is_noun = noun in ENGLISH and noun not in {"assault"}
            docs.append(
                parse(
                    text.split(), ["VERB", "PRON", "ADP", "NOUN" if is_noun else "ADJ", "ADV"],
                    HEADS, ["ROOT", "nsubj", "case", "obj" if is_noun else "amod", "advmod"],
                )
            )
        return docs

    def test_suggests_the_context_fitting_word_first(self):
        doc = parse(["Nag-submit", "ako", "ng", "assignmnt", "bukas"], POS, HEADS, DEPS)
        detections, errors = detect_errors(doc, LEXICON)
        self.assertEqual([e["text"] for e in errors if "spelling" in e["reasons"]], ["assignmnt"])

        suggestions = correct_errors(doc, detections, errors, LEXICON, self.fake_parse_many)
        words = [s["word"] for s in suggestions[3]]
        self.assertEqual(words[0], "assignment")
        self.assertEqual(suggestions[3][0]["edit_distance"], 1)
        self.assertEqual(suggestions[3][0]["languages"], ["english"])
        scores = [s["score"] for s in suggestions[3]]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_keeps_capitalization(self):
        doc = parse(["Nag-submit", "ako", "ng", "Assignmnt", "bukas"], POS, HEADS, DEPS)
        detections, errors = detect_errors(doc, LEXICON)
        suggestions = correct_errors(doc, detections, errors, LEXICON, self.fake_parse_many)
        self.assertEqual(suggestions[3][0]["word"], "Assignment")

    def test_corrects_only_the_misspelled_root(self):
        doc = parse(["na-strss", "ako"], ["VERB", "PRON"], [0, 0], ["ROOT", "nsubj"])
        detections, errors = detect_errors(doc, LEXICON)
        suggestions = correct_errors(doc, detections, errors, LEXICON, lambda texts: [doc for _ in texts])
        self.assertEqual(suggestions[0][0]["word"], "na-stress")

    def test_context_error_is_corrected_by_swapping_the_aspect_prefix(self):
        words = ["Nag-submit", "ako", "bukas"]
        pos, heads, deps = ["VERB", "PRON", "ADV"], [0, 0, 0], ["ROOT", "nsubj", "advmod"]
        doc = parse(words, pos, heads, deps)
        detections, errors = detect_errors(doc, LEXICON)
        self.assertEqual([(e["text"], e["reasons"]) for e in errors], [("Nag-submit", ["context"])])

        suggestions = correct_errors(
            doc, detections, errors, LEXICON, lambda texts: [parse(t.split(), pos, heads, deps) for t in texts]
        )
        self.assertEqual([s["word"] for s in suggestions[0]], ["Mag-submit"])
        self.assertEqual(suggestions[0][0]["scores"]["aspect_conflict"], 0)

    def test_word_with_spelling_and_context_errors_gets_one_combined_fix(self):
        pos, heads, deps = ["VERB", "PRON", "ADV"], [0, 0, 0], ["ROOT", "nsubj", "advmod"]
        doc = parse(["Nag-submt", "ako", "bukas"], pos, heads, deps)
        detections, errors = detect_errors(doc, LEXICON)
        self.assertEqual(errors[0]["reasons"], ["spelling", "context"])

        suggestions = correct_errors(
            doc, detections, errors, LEXICON, lambda texts: [parse(t.split(), pos, heads, deps) for t in texts]
        )
        # "Nag-submit" fixes the typo but keeps the conflict, so only "Mag-submit" is offered.
        self.assertEqual([s["word"] for s in suggestions[0]], ["Mag-submit"])
        self.assertEqual(suggestions[0][0]["edit_distance"], 2)

    def test_context_score_joins_the_ranking_when_a_corpus_profile_is_given(self):
        profile = FrequencyProfile()
        profile.add_sentence(parse(SENTENCE, POS, HEADS, DEPS), LEXICON)
        doc = parse(["Nag-submit", "ako", "ng", "assignmnt", "bukas"], POS, HEADS, DEPS)
        detections, errors = detect_errors(doc, LEXICON)
        suggestions = correct_errors(doc, detections, errors, LEXICON, self.fake_parse_many, profile=profile)[3]

        by_word = {s["word"]: s for s in suggestions}
        self.assertEqual(suggestions[0]["word"], "assignment")
        self.assertEqual(by_word["assignment"]["scores"]["context_score"], 1.0)
        self.assertEqual(by_word["assignments"]["scores"]["context_score"], 1.0)
        self.assertIn("context", by_word["assignment"]["details"])

    def test_no_context_score_without_a_corpus_profile(self):
        doc = parse(["Nag-submit", "ako", "ng", "assignmnt", "bukas"], POS, HEADS, DEPS)
        detections, errors = detect_errors(doc, LEXICON)
        suggestions = correct_errors(doc, detections, errors, LEXICON, self.fake_parse_many)[3]
        self.assertNotIn("context_score", suggestions[0]["scores"])

    def test_correctly_spelled_words_get_no_suggestions(self):
        doc = parse(["Nag-submit", "ako", "kahapon"], ["VERB", "PRON", "ADV"], [0, 0, 0], ["ROOT", "nsubj", "advmod"])
        detections, errors = detect_errors(doc, LEXICON)
        self.assertEqual(correct_errors(doc, detections, errors, LEXICON, self.fake_parse_many), {})


if __name__ == "__main__":
    unittest.main()
