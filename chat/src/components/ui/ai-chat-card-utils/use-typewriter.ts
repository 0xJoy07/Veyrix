import { useEffect, useState } from "react";

type Phase = "typing" | "holding" | "deleting" | "gap";
interface TypewriterOptions {
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  gapMs?: number;
  enabled?: boolean;
}

export function useTypewriter(prompts: string[], {
  typeMs = 48, deleteMs = 14, holdMs = 3400, gapMs = 900, enabled = true,
}: TypewriterOptions = {}) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const current = prompts[index % Math.max(prompts.length, 1)] ?? "";

  useEffect(() => {
    if (!enabled || !prompts.length) return;
    const delay = phase === "holding" ? holdMs : phase === "gap" ? gapMs : phase === "deleting" ? deleteMs : typeMs;
    const timer = window.setTimeout(() => {
      if (phase === "typing") {
        if (text.length < current.length) setText(current.slice(0, text.length + 1));
        else setPhase("holding");
      } else if (phase === "holding") setPhase("deleting");
      else if (phase === "deleting") {
        if (text.length) setText(text.slice(0, -1));
        else setPhase("gap");
      } else {
        setIndex((value) => value + 1);
        setPhase("typing");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [current, text, phase, enabled, prompts.length, typeMs, deleteMs, holdMs, gapMs]);

  return { text, phase };
}
