"use client";

import type { Element, Root, RootContent, Text } from "hast";
import "./response-stream.css";

export interface ResponseRevealOptions {
  enabled?: boolean;
  fadeDuration?: number;
  segmentDelay?: number;
  /** Maximum delay before the last word starts, even for long responses. */
  maxStagger?: number;
}

function bounded(value: number | undefined, fallback: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(0, value))
    : fallback;
}

/**
 * Adaptation of ResponseStream's word fade for Markdown. Run after Markdown has
 * become HAST: headings, lists, links and tables are already structurally final
 * before any text is revealed. No partial Markdown is ever rendered.
 */
export function rehypeResponseReveal({
  enabled = true,
  fadeDuration = 1200,
  segmentDelay = 24,
  maxStagger = 4000,
}: ResponseRevealOptions = {}) {
  return (tree: Root) => {
    if (!enabled) return;
    const targets: Element[] = [];

    function visit(parent: Root | Element) {
      const children: RootContent[] = [];
      for (const child of parent.children) {
        if (child.type === "text") {
          // Keep original whitespace as actual text, including preformatted
          // content. Inline spans preserve natural line wrapping and copying.
          const pieces = child.value.match(/\s+|\S+/gu) ?? [];
          for (const piece of pieces) {
            const text: Text = { type: "text", value: piece };
            if (/^\s+$/u.test(piece)) children.push(text);
            else {
              const span: Element = {
                type: "element", tagName: "span", properties: {}, children: [text],
              };
              targets.push(span);
              children.push(span);
            }
          }
        } else {
          if (child.type === "element") {
            if (child.tagName === "pre" || child.tagName === "code") {
              // Fade code atomically; do not split code or alter its whitespace.
              targets.push(child);
            } else if (!["script", "style", "textarea"].includes(child.tagName)) {
              visit(child);
            }
          }
          children.push(child);
        }
      }
      parent.children = children;
    }

    visit(tree);
    const delay = Math.min(
      bounded(segmentDelay, 24, 1000),
      bounded(maxStagger, 4000, 10000) / Math.max(1, targets.length - 1),
    );
    const duration = bounded(fadeDuration, 1200, 5000);
    targets.forEach((element, index) => {
      const classes = element.properties.className;
      element.properties.className = [
        ...(Array.isArray(classes) ? classes : []),
        "response-reveal-segment",
      ];
      const existingStyle = typeof element.properties.style === "string" ? element.properties.style : "";
      element.properties.style = `${existingStyle}${existingStyle ? ";" : ""}--response-reveal-delay:${Math.round(index * delay)}ms;--response-reveal-duration:${duration}ms`;
    });
  };
}
