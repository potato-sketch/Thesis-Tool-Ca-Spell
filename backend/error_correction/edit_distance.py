"""ERROR CORRECTION MODULE: Edit distance computation.

A Levenshtein automaton is built from the misspelled word and traversed together
with the word-list automaton (the minimal DFA from the Preprocessing Module).
A word-list path that ends in an accepting state of both automata is a word
within the allowed number of edits (insertions, deletions, substitutions) of the
misspelled word. Paths where the Levenshtein automaton has no live state are
abandoned, so most of the word list is never visited.
"""

MAX_EDIT_DISTANCE = 2


def allowed_distance(word):
    """At most two edits; one for short words, which are within two edits of far too many words."""
    return 1 if len(word) <= 3 else MAX_EDIT_DISTANCE


class LevenshteinAutomaton:
    """NFA over (characters of the word consumed, edits used) states, simulated
    as a dict {characters consumed: fewest edits}."""

    def __init__(self, word, max_distance):
        self.word = word
        self.length = len(word)
        self.max_distance = max_distance

    def start(self):
        return self._with_deletions({0: 0})

    def step(self, states, char):
        """States reached after reading one more character of the candidate word."""
        reached = {}

        def add(consumed, edits):
            if edits <= self.max_distance and reached.get(consumed, self.max_distance + 1) > edits:
                reached[consumed] = edits

        for consumed, edits in states.items():
            if consumed < self.length:
                add(consumed + 1, edits if self.word[consumed] == char else edits + 1)  # match / substitution
            add(consumed, edits + 1)  # insertion: the candidate has an extra character
        return self._with_deletions(reached)

    def distance(self, states):
        """Edits needed if the candidate ends here, or None when it is too far away."""
        return states.get(self.length)

    def _with_deletions(self, states):
        # Deletion: the candidate skips a character of the misspelled word (no input read).
        for consumed in range(self.length):
            edits = states.get(consumed)
            if edits is not None and edits < self.max_distance:
                if states.get(consumed + 1, self.max_distance + 1) > edits + 1:
                    states[consumed + 1] = edits + 1
        return states


def search(automaton, word, max_distance=None):
    """Every word accepted by `automaton` within `max_distance` edits of `word`,
    as {candidate: edit distance}."""
    if max_distance is None:
        max_distance = allowed_distance(word)
    levenshtein = LevenshteinAutomaton(word, max_distance)
    found = {}
    stack = [(0, "", levenshtein.start())]
    while stack:
        state, prefix, states = stack.pop()
        if automaton.finals[state]:
            distance = levenshtein.distance(states)
            if distance is not None:
                found[prefix] = distance
        for char, target in automaton.transitions[state].items():
            reached = levenshtein.step(states, char)
            if reached:
                stack.append((target, prefix + char, reached))
    return found


def edit_distance(a, b):
    """Levenshtein distance between two words."""
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, 1):
        current = [i]
        for j, char_b in enumerate(b, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (char_a != char_b)))
        previous = current
    return previous[-1]
