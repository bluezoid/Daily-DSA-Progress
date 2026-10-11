"use client";

import { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight code input: monospace, no spellcheck, Tab inserts 4 spaces.
 * Press Esc first to let Tab move focus out (keyboard accessibility).
 */
export const CodeTextarea = forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(function CodeTextarea(
  { className, onKeyDown, ...props },
  ref,
) {
  const escaped = useRef(false);
  return (
    <textarea
      ref={ref}
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      autoCorrect="off"
      className={cn(
        "min-h-64 w-full resize-y rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-[13px] leading-6 shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive",
        className,
      )}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Escape") {
          escaped.current = true;
          return;
        }
        if (e.key === "Tab" && !e.shiftKey && !escaped.current) {
          e.preventDefault();
          const el = e.currentTarget;
          const { selectionStart: s, selectionEnd: end } = el;
          el.setRangeText("    ", s, end, "end");
          el.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
        escaped.current = false;
      }}
      {...props}
    />
  );
});
