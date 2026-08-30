import type { ReactNode } from "react";
import { cn } from "@repo/ui/utils";

export function SheetPage({
  toolbar,
  error,
  children,
}: {
  toolbar?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface">
      {toolbar ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          {toolbar}
        </div>
      ) : null}
      {error ? <p className="shrink-0 px-4 py-2 text-sm text-red-600">{error}</p> : null}
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export function SheetPadded({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-h-0 flex-1 overflow-auto px-4 py-4", className)}>{children}</div>;
}

export function SheetTable({
  children,
  minWidth,
  empty,
}: {
  children: ReactNode;
  minWidth?: string;
  empty?: ReactNode;
}) {
  return (
    <>
      <table className="w-full border-collapse text-left text-sm" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
      {empty}
    </>
  );
}

export function sheetTh(className?: string): string {
  return cn(
    "border-b border-r border-border bg-slate-50 px-3 py-2 text-[13px] font-semibold text-foreground last:border-r-0",
    className,
  );
}

export function sheetTd(className?: string): string {
  return cn("border-b border-r border-border px-3 py-1.5 text-muted last:border-r-0", className);
}

export function sheetTr(className?: string): string {
  return cn("hover:bg-slate-50/80", className);
}