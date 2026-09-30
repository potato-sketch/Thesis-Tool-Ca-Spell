"""PREPROCESSING MODULE: Automaton encoding.

Minimal acyclic deterministic finite automaton (DAFSA) for word lists.

Built with the incremental algorithm for sorted input from Daciuk, Mihov,
Watson & Watson (2000), "Incremental Construction of Minimal Acyclic Finite-State
Automata", Computational Linguistics 26(1). Words that share prefixes share a
path from the start state, and words that share suffixes share the states at the
end, so the automaton is the smallest DFA that accepts exactly the word list.
"""

import pickle
from pathlib import Path

FORMAT_VERSION = 1


class _BuildState:
    __slots__ = ("edges", "final", "id")

    def __init__(self, state_id):
        self.edges = {}
        self.final = False
        self.id = state_id

    def signature(self):
        # Two states are equivalent when they agree on finality and every
        # outgoing edge leads to the same (already minimized) state.
        return (self.final, tuple((char, child.id) for char, child in sorted(self.edges.items())))


class WordAutomaton:
    """Read-only minimal DFA. State 0 is the start state."""

    def __init__(self, transitions, finals, word_count):
        self.transitions = transitions  # list[dict[str, int]], indexed by state
        self.finals = finals  # bytearray, 1 where the state accepts
        self.word_count = word_count

    @classmethod
    def from_words(cls, words):
        """Encode an iterable of words. Duplicates and ordering do not matter."""
        words = sorted(set(words))
        next_id = 0

        def new_state():
            nonlocal next_id
            state = _BuildState(next_id)
            next_id += 1
            return state

        root = new_state()
        register = {}
        # Path of the previously added word: (parent, char, child) triples.
        unchecked = []

        def minimize(down_to):
            while len(unchecked) > down_to:
                parent, char, child = unchecked.pop()
                signature = child.signature()
                existing = register.get(signature)
                if existing is not None:
                    parent.edges[char] = existing
                else:
                    register[signature] = child

        previous = ""
        for word in words:
            if not word:
                continue
            prefix_len = 0
            for a, b in zip(word, previous):
                if a != b:
                    break
                prefix_len += 1

            # Everything after the shared prefix is final: no later word
            # (in sorted order) can extend it, so it can be merged now.
            minimize(prefix_len)

            node = unchecked[-1][2] if unchecked else root
            for char in word[prefix_len:]:
                child = new_state()
                node.edges[char] = child
                unchecked.append((node, char, child))
                node = child
            node.final = True
            previous = word

        minimize(0)
        return cls._freeze(root, len(words))

    @classmethod
    def _freeze(cls, root, word_count):
        # Renumber the reachable states densely, start state first.
        index = {id(root): 0}
        order = [root]
        for state in order:
            for child in state.edges.values():
                if id(child) not in index:
                    index[id(child)] = len(order)
                    order.append(child)

        transitions = [
            {char: index[id(child)] for char, child in state.edges.items()} for state in order
        ]
        finals = bytearray(1 if state.final else 0 for state in order)
        return cls(transitions, finals, word_count)

    def __contains__(self, word):
        state = 0
        for char in word:
            state = self.transitions[state].get(char)
            if state is None:
                return False
        return bool(self.finals[state])

    def __len__(self):
        return self.word_count

    def __iter__(self):
        """Yield every accepted word in sorted order."""
        stack = [(0, "")]
        while stack:
            state, prefix = stack.pop()
            if self.finals[state]:
                yield prefix
            for char, target in sorted(self.transitions[state].items(), reverse=True):
                stack.append((target, prefix + char))

    @property
    def state_count(self):
        return len(self.transitions)

    @property
    def transition_count(self):
        return sum(len(edges) for edges in self.transitions)

    def stats(self):
        return {
            "words": self.word_count,
            "states": self.state_count,
            "transitions": self.transition_count,
        }

    def save(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("wb") as handle:
            pickle.dump(
                (FORMAT_VERSION, self.transitions, bytes(self.finals), self.word_count),
                handle,
                protocol=pickle.HIGHEST_PROTOCOL,
            )

    @classmethod
    def load(cls, path):
        with Path(path).open("rb") as handle:
            version, transitions, finals, word_count = pickle.load(handle)
        if version != FORMAT_VERSION:
            raise ValueError(f"Unsupported automaton format version {version} in {path}")
        return cls(transitions, bytearray(finals), word_count)
