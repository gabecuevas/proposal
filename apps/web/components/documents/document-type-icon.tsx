"use client";

import type { ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import {
  documentKindFromVariables,
  editorLayoutFromVariables,
  type EditorLayout,
} from "@/lib/editor/document-kind";
import type { VariableContext } from "@/lib/editor/types";

/** Uniform list/table size for Doc · Quote · PDF type icons. */
export const TYPE_LIST_ICON_SIZE = 20;

type IconProps = {
  className?: string;
  size?: number;
  title?: string;
};

function BrandTypeIcon({
  src,
  size = TYPE_LIST_ICON_SIZE,
  title,
  className,
}: IconProps & { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset
    <img
      src={`${src}?v=2`}
      alt=""
      width={size}
      height={size}
      title={title}
      className={cn("block shrink-0 object-contain object-center", className)}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

/** Brand Doc icon used for Flow documents in lists and the editor chrome. */
export function FlowDocTypeIcon(props: IconProps) {
  return <BrandTypeIcon src="/brand/flow-doc-icon.png" title={props.title ?? "Document"} {...props} />;
}

/** Brand Quote icon used for quotes in lists and chrome. */
export function QuoteDocTypeIcon(props: IconProps) {
  return <BrandTypeIcon src="/brand/quote-doc-icon.png" title={props.title ?? "Quote"} {...props} />;
}

/** Brand Invoice icon used for invoices in lists and chrome. */
export function InvoiceDocTypeIcon(props: IconProps) {
  return <BrandTypeIcon src="/brand/invoice-doc-icon.png" title={props.title ?? "Invoice"} {...props} />;
}

/** Brand PDF icon used for PDF templates in lists. */
export function PdfDocTypeIcon(props: IconProps) {
  return <BrandTypeIcon src="/brand/pdf-doc-icon.png" title={props.title ?? "PDF"} {...props} />;
}

function TypeIconLabel({
  label,
  title,
  className,
  children,
}: {
  label: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1.5", className)}
      title={title ?? label}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center"
        style={{ width: TYPE_LIST_ICON_SIZE, height: TYPE_LIST_ICON_SIZE }}
      >
        {children}
      </span>
      <span className="text-xs font-medium leading-none text-muted">{label}</span>
    </span>
  );
}

/** Type cell for document lists — Doc icon for Flow, Quote icon for Quote/Invoice. */
export function DocumentTypeCell({
  variables,
  layout,
  className,
}: {
  variables?: VariableContext | null;
  layout?: EditorLayout | null;
  className?: string;
}) {
  const kind = documentKindFromVariables(variables);
  if (kind === "quote" || kind === "invoice") {
    const label = kind === "invoice" ? "Invoice" : "Quote";
    return (
      <TypeIconLabel label={label} className={className}>
        {kind === "invoice" ? (
          <InvoiceDocTypeIcon size={TYPE_LIST_ICON_SIZE} />
        ) : (
          <QuoteDocTypeIcon size={TYPE_LIST_ICON_SIZE} />
        )}
      </TypeIconLabel>
    );
  }

  const resolved = layout ?? editorLayoutFromVariables(variables);
  if (resolved === "flow") {
    return (
      <TypeIconLabel label="Doc" title="Document" className={className}>
        <FlowDocTypeIcon size={TYPE_LIST_ICON_SIZE} />
      </TypeIconLabel>
    );
  }
  return (
    <span className={cn("text-xs text-muted", className)} title="Page document">
      Page
    </span>
  );
}

/** Type cell for library templates (Doc / Quote / Invoice / PDF / DOCX / Custom). */
export function TemplateTypeCell({
  kind,
  className,
}: {
  kind: string;
  className?: string;
}) {
  if (kind === "Doc") {
    return (
      <TypeIconLabel label="Doc" title="Document" className={className}>
        <FlowDocTypeIcon size={TYPE_LIST_ICON_SIZE} />
      </TypeIconLabel>
    );
  }
  if (kind === "Quote") {
    return (
      <TypeIconLabel label="Quote" className={className}>
        <QuoteDocTypeIcon size={TYPE_LIST_ICON_SIZE} />
      </TypeIconLabel>
    );
  }
  if (kind === "Invoice") {
    return (
      <TypeIconLabel label="Invoice" className={className}>
        <InvoiceDocTypeIcon size={TYPE_LIST_ICON_SIZE} />
      </TypeIconLabel>
    );
  }
  if (kind === "PDF") {
    return (
      <TypeIconLabel label="PDF" className={className}>
        <PdfDocTypeIcon size={TYPE_LIST_ICON_SIZE} />
      </TypeIconLabel>
    );
  }
  return <span className={cn("text-xs text-muted", className)}>{kind}</span>;
}
