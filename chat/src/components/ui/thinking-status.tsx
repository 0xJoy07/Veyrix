"use client";

import { useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThinkingOrb } from "@/components/ui/thinking-orbs";

export interface ThinkingStatusProps {
  className?: string;
  label?: string;
}

/** Mount only while a request is pending; unmounting also stops the orb canvas. */
export function ThinkingStatus({ className, label = "Thinking…" }: ThinkingStatusProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className={cn("px-5 pb-5 sm:px-6", className)}>
      <div
        className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full border border-[#e1e5da] bg-[#f2f4ee] py-2 pl-3 pr-4"
      >
        <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center [&_canvas]:!size-5">
          {reducedMotion !== false
            ? <Sparkles className="size-4 text-[#61754b]" strokeWidth={1.5} />
            : <ThinkingOrb state="composing" size={20} theme="light" color="#61754b" />}
        </span>
        <span className="text-xs font-medium leading-5 text-[#59634f]">{label}</span>
      </div>
    </div>
  );
}

export default ThinkingStatus;
