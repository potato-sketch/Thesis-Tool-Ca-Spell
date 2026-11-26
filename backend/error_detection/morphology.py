"""ERROR DETECTION MODULE: Morphological rules (Taglish).

Affix inventory and orthographic conventions used by code-switching and
compound word checking. The hyphenation rules follow the KWF Manwal sa
Masinop na Pagsulat (section numbers in brackets):

  H1  Prefix ending in a consonant + segment starting with a vowel takes a
      hyphen [11.3]:                       mag-aral, pag-ibig, mag-aaral
  H2  Affix + foreign word in its original spelling takes a hyphen before the
      root, even after a vowel-final prefix [11.3, 12.40]:
                                           nag-submit, i-save, pa-cute, maki-computer
      Affix + proper noun likewise [11.3, 12.40]: taga-Maynila, pa-Mandaluyong,
      naka-Gucci (an unknown capitalized root is taken as a proper noun)
      A repeated syllable stays with the prefix: only the first consonant and
      vowel of a cluster repeat [2.3]:     magbe-blessing, ipako-close, ise-share
  H3  Any other hyphen between an affix and a Tagalog root is unnecessary:
                                           nag-kain -> nagkain, pakyut, makikompiyuter
      A hyphen before a suffix is accepted for English roots only:
                                           commrnt-an, commrntan
  H4  Repeated words take a hyphen; a word of three or more syllables repeats
      only its first two, and a prefix joins the first half [11.1]:
                                           araw-araw, pali-palito, pabalik-balik,
                                           suntok-suntukan (o becomes u in the second half)
      A contraction is not a repeated word [11.1]: iba't-iba -> iba't iba
  H5  de- ("made or used by"), di- (idiomatic "not") and kontra- always take a
      hyphen [11.9, 11.10, 12.40]:         de-lata, di-mahipo, kontra-Marxismo
"""

from dataclasses import dataclass

from preprocessing.lexicon import normalize

VOWELS = frozenset("aeiou")

PREFIXES = (
    "i", "ka", "ma", "na", "pa", "ipa", "ika", "taga", "tag",
    "mag", "nag", "pag", "ipag", "pinag",
    "mang", "nang", "pang", "man", "nan", "pan", "mam", "nam", "pam",
    "maka", "naka", "makapag", "nakapag", "makapang", "nakapang",
    "makipag", "nakipag", "pakikipag", "makikipag", "nakikipag",
    "magpa", "nagpa", "pagpa", "magpaka", "nagpaka", "pagka", "pinaka",
    "mapa", "napa", "mapag", "napag", "ipina", "ipinag",
    # KWF 11.3 (maki-computer) and other prefixes common in Taglish (paki-check, napaka-cool,
    # nakaka-stress, magka-crush, pina-deliver).
    "maki", "naki", "paki", "makiki", "nakiki", "pakiki",
    "napaka", "nakaka", "makaka", "magka", "nagka", "pina",
)
# Prefixes that always take a hyphen and are only recognized with one (H5), so a word such as
# "dilaw" is never misread as di- + law.
HYPHEN_ONLY_PREFIXES = ("de", "di", "kontra")
# Contractions written with a hyphen as if they were repeated words (H4).
CONTRACTION_HYPHENS = {"iba't-iba": "iba't iba", "samo't-sari": "samo't sari"}
INFIXES = ("um", "in")
SUFFIXES = ("an", "han", "in", "hin")
# Prefixes an infix can follow: um/in go inside the root ("k-um-ain") or after i- ("i-k-in-uha").
PREFIXES_BEFORE_INFIX = ("", "i")
MIN_ROOT_LENGTH = 3


def onset_length(word):
    """Number of consonants before the first vowel."""
    for index, char in enumerate(word):
        if char in VOWELS:
            return index
    return len(word)


def reduplications(root):
    """Syllables that may be repeated before the root to mark aspect.

    Tagalog repeats the first consonant + vowel ("kain" -> "ka-kain"); English roots
    in Taglish repeat the first consonant (or cluster) + vowel ("submit" -> "su",
    "print" -> "pi"/"pri", "attend" -> "a").
    """
    onset = onset_length(root)
    if onset >= len(root):
        return set()
    candidates = {root[: onset + 1]}
    if onset > 1:
        candidates.add(root[0] + root[onset])
    return candidates


# English spellings of a word's first consonant sound, written the Filipino way (KWF 2.3).
_SOUNDS = (("sch", "sk"), ("sh", "s"), ("ch", "ts"), ("ph", "f"), ("kn", "n"), ("wr", "r"), ("qu", "k"))


def sounded_reduplications(root):
    """Repeated syllables of an English root written as they sound, as the KWF Manwal does
    (2.3: magbe-blessing, ipako-close, ise-share): the first consonant sound respelled
    (c -> k or s, sh -> s, ph -> f, ...) and whichever vowel is heard."""
    onset = onset_length(root)
    if onset == 0 or onset >= len(root):
        return set()
    consonant = next((sound for spelling, sound in _SOUNDS if root.startswith(spelling)), None)
    if consonant is None:
        first = root[0]
        if first == "c":
            consonant = "s" if root[1:2] in ("e", "i", "y") else "k"
        else:
            consonant = {"q": "k", "x": "s"}.get(first, first)
    return {consonant + vowel for vowel in VOWELS}


@dataclass(frozen=True)
class Segmentation:
    """word = prefix + reduplication + root + suffix, with an optional infix
    inserted after the onset of the first segment following the prefix."""

    word: str  # normalized, without hyphens
    prefix: str
    infix: str
    reduplication: str
    root: str
    suffix: str
    root_languages: tuple

    @property
    def root_start(self):
        return len(self.prefix) + len(self.reduplication) + len(self.infix)

    @property
    def suffix_start(self):
        return len(self.word) - len(self.suffix)

    def boundaries(self):
        """Positions (in the word without hyphens) where a hyphen may appear."""
        points = set()
        if self.prefix:
            points.add(len(self.prefix))
        if self.reduplication:
            points.add(self.root_start)
        if self.suffix:
            points.add(self.suffix_start)
        return points

    def as_dict(self):
        return {
            "prefix": self.prefix,
            "infix": self.infix,
            "reduplication": self.reduplication,
            "root": self.root,
            "suffix": self.suffix,
            "root_languages": list(self.root_languages),
        }


def _without_infix(body, prefix):
    yield "", body
    if prefix not in PREFIXES_BEFORE_INFIX:
        return
    onset = onset_length(body)
    if onset == 0:
        # Vowel-initial roots take um/in at the front: "um-alis", "in-alis".
        if body[:2] in INFIXES and body[2:3] in VOWELS:
            yield body[:2], body[2:]
        return
    for position in range(1, onset + 1):
        infix = body[position : position + 2]
        if infix in INFIXES:
            yield infix, body[:position] + body[position + 2 :]


def _without_reduplication(body):
    """(syllable, rest, english_only): english_only marks a syllable written as it sounds,
    valid only before an English root."""
    yield "", body, False
    for length in range(1, 5):
        syllable, rest = body[:length], body[length:]
        if syllable in reduplications(rest):
            yield syllable, rest, False
        elif syllable in sounded_reduplications(rest):
            yield syllable, rest, True


def segmentations(word, lookup):
    """All affixed readings of `word` whose root is in a word list.

    `lookup(root)` returns the languages whose word list contains the root.
    """
    for prefix in ("",) + PREFIXES:
        if not word.startswith(prefix):
            continue
        for infix, body in _without_infix(word[len(prefix) :], prefix):
            for reduplication, rest, english_only in _without_reduplication(body):
                for suffix in ("",) + SUFFIXES:
                    if suffix and not rest.endswith(suffix):
                        continue
                    root = rest[: len(rest) - len(suffix)]
                    if len(root) < MIN_ROOT_LENGTH:
                        continue
                    if not (prefix or infix or reduplication or suffix):
                        continue  # the bare word is the dictionary lookup's job
                    languages = lookup(root)
                    if english_only and "english" not in languages:
                        continue
                    if languages:
                        yield Segmentation(
                            word, prefix, infix, reduplication, root, suffix, tuple(languages)
                        )


def linker_bases(text):
    """Base words behind the linker -ng and the contractions 'y / 't:
    "magandang" -> "maganda", "aming" -> "amin", "ako'y" -> "ako", "siya't" -> "siya"."""
    bases = []
    for contraction in ("'y", "'t"):
        if text.endswith(contraction) and len(text) > 3:
            bases.append(text[:-2])
    lowered = text.lower()
    if lowered.endswith("ng") and len(text) > 3:
        if lowered[-3] in VOWELS:
            bases.append(text[:-2])  # vowel-final word + ng: isa -> isang
        bases.append(text[:-1])  # n-final word + g: amin -> aming
    return bases


def _vowel_count(text):
    return sum(char in VOWELS for char in text)


def _o_as_u(text):
    return text.replace("o", "u")


def _known_with_suffix(word, lookup):
    """True when `word` or its root under a suffix is a known word: "suntukan" -> "suntok" + an."""
    if lookup(word):
        return True
    for suffix in SUFFIXES:
        root = word[: -len(suffix)]
        if not word.endswith(suffix) or len(root) < MIN_ROOT_LENGTH:
            continue
        if lookup(root):
            return True
        # The root's last o becomes u before a suffix: suntok -> suntukan.
        last_u = root.rfind("u")
        if last_u >= 0 and lookup(root[:last_u] + "o" + root[last_u + 1 :]):
            return True
    return False


def repeated_word_prefix(first, second, lookup):
    """H4: the prefix ("" when none) when "first-second" is a repeated word, else None.

    The first half repeats the whole second word or, for words of three or more syllables, its
    first two syllables; a prefix joins the first half; o in the first half may be u in the second:
    araw-araw, pali-palito, bali-baligtad, pabalik-balik, nagkawasak-wasak, suntok-suntukan.
    """
    first, second = normalize(first), normalize(second)
    if not _known_with_suffix(second, lookup):
        return None
    for prefix in ("",) + PREFIXES:
        if not first.startswith(prefix):
            continue
        part = first[len(prefix) :]
        if len(part) < 2 or _o_as_u(part) != _o_as_u(second[: len(part)]):
            continue
        if part == second or _vowel_count(part) >= 2:
            return prefix
    return None


def hyphen_positions(text):
    """Positions in the hyphen-free word where the writer put a hyphen:
    "nagsu-submit" -> {5}."""
    positions, position = set(), 0
    for part in text.split("-")[:-1]:
        position += len(part)
        positions.add(position)
    return positions


def readings(text, lookup):
    """Affixed readings of `text` whose morpheme boundaries include every
    hyphen the writer used, so "mag-aaral" is read as mag- + aaral, not ma- + gaaral."""
    hyphens = hyphen_positions(text)
    for segmentation in segmentations(normalize(text.replace("-", "")), lookup):
        if hyphens <= segmentation.boundaries():
            yield segmentation


def hyphen_rules(segmentation, proper_noun_root=False):
    """Apply H1-H3. Returns (required, optional) hyphen positions."""
    s = segmentation
    english_only = "english" in s.root_languages and "tagalog" not in s.root_languages
    tagalog_only = "tagalog" in s.root_languages and "english" not in s.root_languages
    required, optional = set(), set()

    # H1: consonant-final prefix before a vowel ("mag-aral", "mag-aaral").
    if s.prefix and s.prefix[-1] not in VOWELS and s.word[len(s.prefix)] in VOWELS:
        required.add(len(s.prefix))

    # H2: affix before an English root or a proper noun ("nag-submit", "taga-Maynila").
    if (s.prefix or s.reduplication) and not s.infix:
        if english_only or proper_noun_root:
            required.add(s.root_start)
        elif not tagalog_only:
            optional.add(s.root_start)  # root is in both word lists

    # H3: suffix hyphen only for English roots ("commrnt-an").
    if s.suffix and not tagalog_only:
        optional.add(s.suffix_start)

    return required, optional - required


def with_hyphens(letters, positions):
    """Insert hyphens into `letters` before each position."""
    out = []
    for index, char in enumerate(letters):
        if index in positions:
            out.append("-")
        out.append(char)
    return "".join(out)


def is_misspelled_prefix(chunk):
    """True when `chunk` is one edit (insert, delete, substitute) away from a prefix: "nagg", "mga"."""
    chunk = chunk.replace("-", "")
    return chunk not in PREFIXES and any(_within_one_edit(chunk, prefix) for prefix in PREFIXES)


def _within_one_edit(a, b):
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) <= 1
    shorter, longer = sorted((a, b), key=len)
    return any(longer[:i] + longer[i + 1 :] == shorter for i in range(len(longer)))


def is_affix_chunk(chunk):
    """True for text that can precede a root: a prefix, a reduplicated syllable,
    or a prefix followed by one ("nag", "su", "nagsu", "nag-a")."""
    chunk = chunk.replace("-", "")
    if chunk in PREFIXES:
        return True
    for prefix in ("",) + PREFIXES:
        rest = chunk[len(prefix) :]
        if chunk.startswith(prefix) and 1 <= len(rest) <= 3 and rest[-1] in VOWELS:
            return True
    return False
