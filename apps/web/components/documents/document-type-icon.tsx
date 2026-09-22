"use client";

import { cn } from "@repo/ui/utils";
import {
  editorLayoutFromVariables,
  type EditorLayout,
} from "@/lib/editor/document-kind";
import type { VariableContext } from "@/lib/editor/types";

type Props = {
  className?: string;
  size?: number;
  title?: string;
};

/** Brand Doc icon used for Flow documents in lists and the editor chrome. */
export function FlowDocTypeIcon({ className, size = 20, title = "Document" }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset
    <img
      src="/brand/flow-doc-icon.png"
      alt=""
      width={size}
      height={size}
      title={title}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** Type cell for document lists — shows Doc icon for Flow layout docs. */
export function DocumentTypeCell({
  variables,
  layout,
  className,
}: {
  variables?: VariableContext | null;
  layout?: EditorLayout | null;
  className?: string;
}) {
  const resolved = layout ?? editorLayoutFromVariables(variables);
  if (resolved === "flow") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)} title="Document">
        <FlowDocTypeIcon size={22} />
        <span className="text-xs font-medium text-muted">Doc</span>
      </span>
    );
  }
  return (
    <span className={cn("text-xs text-muted", className)} title="Page document">
      Page
    </span>
  );
}

/** Type cell for library templates (Doc / PDF / DOCX / Custom). */
export function TemplateTypeCell({
  kind,
  className,
}: {
  kind: string;
  className?: string;
}) {
  if (kind === "Doc") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)} title="Document">
        <FlowDocTypeIcon size={22} />
        <span className="text-xs font-medium text-muted">Doc</span>
      </span>
    );
  }
  return <span className={cn("text-xs text-muted", className)}>{kind}</span>;
}
