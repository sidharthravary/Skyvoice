"use client";

import { Fragment, ReactNode } from "react";

// Tiny dependency-free markdown renderer for AI replies. Supports **bold**,
// *italic*, `inline code`, bullet lists (-/*/•), numbered lists, and
// paragraphs. Builds React elements — no HTML injection possible.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Split on **bold**, *italic*, `code`
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${keyPrefix}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code
          key={`${keyPrefix}-c${i}`}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.9em",
            background: "rgba(79,125,243,0.10)",
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(<em key={`${keyPrefix}-i${i}`}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
    i++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let listOrdered = false;

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      listOrdered ? (
        <ol key={key} style={{ margin: "4px 0", paddingLeft: 20, listStyle: "decimal" }}>{items}</ol>
      ) : (
        <ul key={key} style={{ margin: "4px 0", paddingLeft: 20, listStyle: "disc" }}>{items}</ul>
      )
    );
  };

  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);

    if (bullet) {
      if (listItems.length > 0 && listOrdered) flushList(`l${idx}`);
      listOrdered = false;
      listItems.push(<li key={`li${idx}`}>{renderInline(bullet[1], `l${idx}`)}</li>);
    } else if (numbered) {
      if (listItems.length > 0 && !listOrdered) flushList(`l${idx}`);
      listOrdered = true;
      listItems.push(<li key={`li${idx}`}>{renderInline(numbered[1], `l${idx}`)}</li>);
    } else {
      flushList(`l${idx}`);
      if (line.trim() === "") {
        blocks.push(<Fragment key={`sp${idx}`}> </Fragment>);
      } else {
        blocks.push(
          <p key={`p${idx}`} style={{ margin: blocks.length > 0 ? "6px 0 0" : 0 }}>
            {renderInline(line, `p${idx}`)}
          </p>
        );
      }
    }
  });
  flushList("lend");

  return <>{blocks}</>;
}
