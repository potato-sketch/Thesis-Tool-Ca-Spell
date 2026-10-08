import { useRef, useState } from "react";
import { describeCorrection } from "./kwfRules";

const TOOLTIP_WIDTH = 340;

function Tooltip({ hover, onEnter, onLeave }) {
  const { edit, rect } = hover;
  const { why, rules } = describeCorrection(edit);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - TOOLTIP_WIDTH - 8));
  const spaceBelow = window.innerHeight - rect.bottom - 16;
  const spaceAbove = rect.top - 16;
  const below = spaceBelow >= Math.min(spaceAbove, 380);
  const position = below
    ? { top: rect.bottom + 8, maxHeight: spaceBelow }
    : { bottom: window.innerHeight - rect.top + 8, maxHeight: spaceAbove };
  return (
    <div
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed z-[200] overflow-y-auto rounded-lg bg-slate-900 p-3 text-left font-sans text-xs leading-relaxed text-white shadow-xl"
      style={{ left, width: TOOLTIP_WIDTH, ...position }}
    >
      <p className="text-sm">
        <span className="text-red-300 line-through">{edit.original}</span>
        <span className="mx-1.5 text-slate-400">→</span>
        <span className="font-bold text-emerald-300">{edit.word}</span>
      </p>
      <p className="mt-1 text-slate-300">
        <span className="font-semibold text-white">Why it was flagged:</span> {why}
      </p>
      {rules.map((rule) => (
        <div key={rule.code} className="mt-2 rounded-md bg-white/10 p-2">
          <p className="font-semibold">
            <span className="mr-1.5 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">{rule.code}</span>
            {rule.title}
          </p>
          <p className="mt-1 text-slate-200">{rule.text}</p>
          {rule.examples && <p className="mt-1 italic text-slate-300">e.g. {rule.examples}</p>}
          <p className="mt-1 text-slate-200">
            <span className="font-semibold text-white">Reference:</span> {rule.reference}
          </p>
          <p className="text-slate-300">
            <span className="font-semibold text-white">Where to verify:</span> {rule.topic}
          </p>
        </div>
      ))}
      <p className="mt-2 text-[10px] text-slate-400">
        This is Ca-Spell's summary of the rule it applied. Confirm it against the reference's own wording.
      </p>
    </div>
  );
}

export default function CorrectedPreview({ text, edits }) {
  const [hover, setHover] = useState(null);
  const hideTimer = useRef(null);

  const parts = [];
  let cursor = 0;
  for (const edit of [...edits].sort((a, b) => a.start - b.start)) {
    if (edit.start < cursor || text.slice(edit.start, edit.end) !== edit.word) continue;
    parts.push(text.slice(cursor, edit.start), edit);
    cursor = edit.end;
  }
  parts.push(text.slice(cursor));

  const show = (edit, element) => {
    clearTimeout(hideTimer.current);
    setHover({ edit, rect: element.getBoundingClientRect() });
  };
  const keepOpen = () => clearTimeout(hideTimer.current);
  // A short delay lets the pointer travel from the word onto the tooltip.
  const hide = () => {
    hideTimer.current = setTimeout(() => setHover(null), 150);
  };

  return (
    <>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          part
        ) : (
          <span
            key={`${part.index}-${index}`}
            tabIndex={0}
            className="cursor-help rounded-sm underline decoration-emerald-500 decoration-2 underline-offset-4 outline-none focus-visible:bg-emerald-100"
            onMouseEnter={(event) => show(part, event.currentTarget)}
            onMouseLeave={hide}
            onFocus={(event) => show(part, event.currentTarget)}
            onBlur={hide}
          >
            {part.word}
          </span>
        ),
      )}
      {hover && <Tooltip hover={hover} onEnter={keepOpen} onLeave={hide} />}
    </>
  );
}
