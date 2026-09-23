"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { COMMERCIAL_TOKEN_RE } from "@/lib/commercial/variables";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onCaretChange?: (start: number, end: number) => void;
  onFocusField?: () => void;
  readOnly?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Textarea that highlights `[Variable.Tokens]` in amber when not focused,
 * so auto-fill placeholders stand out from normal copy.
 */
export function CommercialTokenField({
  value,
  onChange,
  onCaretChange,
  onFocusField,
  readOnly,
  rows = 3,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightId = useId();

  useEffect(() => {
    if (!focused) {
      return;
    }
    const el = textareaRef.current;
    if (!el) {
      return;
    }
    const report = () => onCaretChange?.(el.selectionStart, el.selectionEnd);
    report();
    el.addEventListener("keyup", report);
    el.addEventListener("click", report);
    el.addEventListener("select", report);
    return () => {
      el.removeEventListener("keyup", report);
      el.removeEventListener("click", report);
      el.removeEventListener("select", report);
    };
  }, [focused, onCaretChange]);

  function focusEditor() {
    if (readOnly) {
      return;
    }
    setFocused(true);
    onFocusField?.();
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  if (!focused && !readOnly) {
    return (
      <button
        type="button"
        id={highlightId}
        aria-label={ariaLabel}
        onClick={focusEditor}
        onFocus={focusEditor}
        className={cn(
          className,
          "block w-full cursor-text whitespace-pre-wrap break-words text-left",
        )}
      >
        {value.trim() ? (
          renderHighlightedTokens(value)
        ) : (
          <span className="text-[#94a3b8]">{placeholder || ""}</span>
        )}
      </button>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      readOnly={readOnly}
      rows={rows}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onChange={(event) => {
        onChange(event.target.value);
        onCaretChange?.(event.target.selectionStart, event.target.selectionEnd);
      }}
      onFocus={() => {
        setFocused(true);
        onFocusField?.();
      }}
      onBlur={(event) => {
        onCaretChange?.(event.target.selectionStart, event.target.selectionEnd);
        setFocused(false);
      }}
    />
  );
}

export function renderHighlightedTokens(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(COMMERCIAL_TOKEN_RE.source, "g");
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push(text.slice(last, index));
    }
    nodes.push(
      <mark
        key={`${index}-${match[0]}`}
        className="rounded bg-amber-100 px-0.5 font-medium text-amber-900"
      >
        {match[0]}
      </mark>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes.length > 0 ? nodes : text;
}
