import { buildTree, describeRelationship } from "./analysisLabels";

function TreeNode({ node, depth, animate }) {
  const [relationship, relationshipHint] = describeRelationship(
    node.token.dependency,
  );
  return (
    <li
      className={`relative pl-7 before:absolute before:left-0 before:top-0 before:h-full before:border-l-2 before:border-slate-300 after:absolute after:left-0 after:top-5 after:w-5 after:border-t-2 after:border-slate-300 last:before:h-5 ${
        animate ? "walk-rise" : ""
      }`}
      style={animate ? { animationDelay: `${depth * 350}ms` } : undefined}
    >
      <div
        title={relationshipHint}
        className="my-1.5 inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm"
      >
        <span className="font-semibold text-slate-900">{node.token.text}</span>
        <span className="rounded-full bg-[#f3e3e3] px-2 py-0.5 text-xs font-medium text-[#800000]">
          {relationship}
        </span>
      </div>
      {node.children.length > 0 && (
        <ul className="ml-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.token.index}
              node={child}
              depth={depth + 1}
              animate={animate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function SentenceTree({ tokens, animate = false }) {
  const roots = buildTree(tokens);
  return (
    <ul>
      {roots.map((root) => (
        <li
          key={root.token.index}
          className={`mb-2 ${animate ? "walk-rise" : ""}`}
        >
          <div
            title={describeRelationship("root")[1]}
            className="inline-flex flex-wrap items-center gap-2 rounded-lg border-2 border-[#800000] bg-white px-3 py-1.5 shadow-sm"
          >
            <span className="font-semibold text-slate-900">
              {root.token.text}
            </span>
            <span className="rounded-full bg-[#800000] px-2 py-0.5 text-xs font-medium text-white">
              {describeRelationship(root.token.dependency)[0]}
            </span>
          </div>
          {root.children.length > 0 && (
            <ul className="ml-4 mt-1">
              {root.children.map((child) => (
                <TreeNode
                  key={child.token.index}
                  node={child}
                  depth={1}
                  animate={animate}
                />
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
