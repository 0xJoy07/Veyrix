"use client";

import { memo } from "react";
import type { RootContent, Element } from "hast";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { rehypeResponseReveal } from "./response-stream";
import "./markdown-response.css";

export interface MarkdownResponseProps {
  content: string;
  /** Reveal the fully formatted response, without ever displaying Markdown source. */
  animate?: boolean;
}

function nodeText(node: RootContent): string {
  if (node.type === "text") return node.value;
  return "children" in node ? node.children.map(nodeText).join("") : "";
}

function columnWeight(header: string) {
  const name = header.trim().toLowerCase();
  if (/^(id|#|no\.?|s\.?no\.?)$/.test(name)) return 7;
  if (/product|item|name|description/.test(name)) return 34;
  if (/price|cost|amount|total/.test(name)) return 16;
  return 21;
}

const components: Components = {
  a({ children, href, title }) {
    if (!href) return <span>{children}</span>;
    return <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>;
  },
  // Model output must not silently load arbitrary remote images or tracking URLs.
  img({ alt }) {
    return alt ? <span className="markdown-image-description">{alt}</span> : null;
  },
  table({ children, node }) {
    const head = node?.children.find((child): child is Element => child.type === "element" && child.tagName === "thead");
    const row = head?.children.find((child): child is Element => child.type === "element" && child.tagName === "tr");
    const weights = row?.children.filter((child): child is Element => child.type === "element" && child.tagName === "th").map(cell => columnWeight(nodeText(cell))) ?? [];
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return <div className="markdown-table-scroll" role="region" aria-label="Response table" tabIndex={0}><table>
      {weights.length > 0 && <colgroup>{weights.map((weight, index) => <col key={index} style={{ width: `${weight / total * 100}%` }} />)}</colgroup>}
      {children}
    </table></div>;
  },
};

export const MarkdownResponse = memo(function MarkdownResponse({ content, animate = false }: MarkdownResponseProps) {
  return (
    <div className="markdown-response">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={animate ? [[rehypeResponseReveal, { enabled: true }]] : []}
        components={components}
        skipHtml
        urlTransform={(url, key) => key === "src" ? "" : defaultUrlTransform(url)}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownResponse;
