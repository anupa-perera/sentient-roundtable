import type { ReactNode } from "react";

/**
 * Lightweight markdown renderer for synthesis findings.
 * Handles headers, bold, italic, lists, and paragraphs without external deps.
 */
export function MarkdownProse({ content }: { content: string }): JSX.Element {
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        return <MarkdownBlock key={index} text={trimmed} />;
      })}
    </div>
  );
}

function MarkdownBlock({ text }: { text: string }): JSX.Element | null {
  // Headers
  if (text.startsWith("### ")) {
    return (
      <h4 className="font-sans text-sm font-bold text-ink dark:text-slate-200">
        {formatInline(text.slice(4))}
      </h4>
    );
  }
  if (text.startsWith("## ")) {
    return (
      <h3 className="font-sans text-base font-bold text-ink dark:text-slate-200">
        {formatInline(text.slice(3))}
      </h3>
    );
  }
  if (text.startsWith("# ")) {
    return (
      <h2 className="font-sans text-lg font-bold text-ink dark:text-slate-100">
        {formatInline(text.slice(2))}
      </h2>
    );
  }

  // Unordered list
  if (/^[-*•] /m.test(text)) {
    const items = text.split("\n").filter((line) => line.trim());
    return (
      <ul className="space-y-1 pl-4">
        {items.map((item, i) => (
          <li
            key={i}
            className="list-disc font-serif text-sm leading-relaxed text-slate-700 marker:text-ember dark:text-slate-300"
          >
            {formatInline(item.replace(/^[-*•]\s*/, ""))}
          </li>
        ))}
      </ul>
    );
  }

  // Ordered list
  if (/^\d+\.\s/m.test(text)) {
    const items = text.split("\n").filter((line) => line.trim());
    return (
      <ol className="space-y-1 pl-4">
        {items.map((item, i) => (
          <li
            key={i}
            className="list-decimal font-serif text-sm leading-relaxed text-slate-700 marker:text-ember dark:text-slate-300"
          >
            {formatInline(item.replace(/^\d+\.\s*/, ""))}
          </li>
        ))}
      </ol>
    );
  }

  // Paragraph
  return (
    <p className="font-serif text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {formatInline(text)}
    </p>
  );
}

/**
 * Parse inline markdown: **bold** and *italic*.
 */
function formatInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={key++} className="font-semibold text-ink dark:text-white">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
