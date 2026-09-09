"use client";

import { useMemo } from "react";
import { cn } from "@repo/ui/utils";
import { isEmptyNoteHtml, sanitizeNoteHtmlForDisplay } from "@/lib/crm/notes-html";

type NotesHtmlProps = {
  html: string;
  className?: string;
};

export function NotesHtml({ html, className }: NotesHtmlProps) {
  const safe = useMemo(() => sanitizeNoteHtmlForDisplay(html), [html]);
  if (!safe || isEmptyNoteHtml(safe)) {
    return null;
  }
  return (
    <div
      className={cn(
        "crm-notes-html text-sm text-foreground",
        "[&_a]:text-primary [&_a]:underline",
        "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_p]:my-0.5",
        "[&_.crm-mention]:rounded [&_.crm-mention]:bg-primary/10 [&_.crm-mention]:px-1 [&_.crm-mention]:font-medium [&_.crm-mention]:text-primary",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
