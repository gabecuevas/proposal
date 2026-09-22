"use client";

import { useEffect, useId, useRef, useState } from "react";

const INFO_COPY =
  "Name the document and add at least one Recipient from CRM People. A draft is saved only after a recipient is added.";

type Props = {
  title?: string;
  className?: string;
  headingId?: string;
};

/** Title row with an info tooltip for Document Info & Recipients. */
export function DocumentInfoRecipientsHeading({
  title = "Document Info & Recipients",
  className,
  headingId,
}: Props) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={className}>
      <div className="flex items-center gap-1.5">
        <h3 id={headingId} className="text-base font-semibold text-foreground">
          {title}
        </h3>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[11px] font-semibold text-muted hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          aria-label="About Document Info & Recipients"
          aria-expanded={open}
          aria-controls={tipId}
          title={INFO_COPY}
          onClick={() => setOpen((value) => !value)}
        >
          i
        </button>
      </div>
      {open ? (
        <p
          id={tipId}
          role="tooltip"
          className="mt-2 max-w-xl rounded-md border border-border bg-slate-50 px-3 py-2 text-xs leading-relaxed text-muted shadow-sm"
        >
          {INFO_COPY}
        </p>
      ) : null}
    </div>
  );
}
