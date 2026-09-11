import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
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
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
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
  fitContent = false,
  preventWrap = false,
}: {
  children: ReactNode;
  minWidth?: string | number;
  empty?: ReactNode;
  /** Size columns to content so they don’t stretch across the viewport. */
  fitContent?: boolean;
  /** Keep cells on one line and grow the table; parent scrolls horizontally when needed. */
  preventWrap?: boolean;
}) {
  const minWidthStyle =
    typeof minWidth === "number"
      ? `${minWidth}px`
      : minWidth
        ? minWidth
        : undefined;

  return (
    <>
      <table
        className={cn(
          "border-collapse text-left text-sm",
          fitContent || preventWrap ? "w-max min-w-full" : "w-full table-fixed",
          preventWrap && "[&_th]:whitespace-nowrap [&_td]:whitespace-nowrap",
        )}
        style={
          minWidthStyle
            ? {
                minWidth: `max(100%, ${minWidthStyle})`,
              }
            : undefined
        }
      >
        {children}
      </table>
      {empty}
    </>
  );
}

export function sheetTh(className?: string): string {
  return cn(
    "whitespace-nowrap border-b border-r border-border bg-slate-50 px-3 py-1.5 text-[13px] font-semibold text-foreground last:border-r-0",
    className,
  );
}

export function sheetTd(className?: string): string {
  return cn("border-b border-r border-border px-3 py-1.5 text-muted last:border-r-0", className);
}

export function sheetTr(className?: string): string {
  return cn("hover:bg-slate-50/80", className);
}

/** Header cell with drag handle for column resizing. */
export function ResizableSheetTh({
  children,
  width,
  className,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: {
  children: ReactNode;
  width: number;
  className?: string;
  onResizeStart: (event: ReactPointerEvent) => void;
  onResizeMove: (event: ReactPointerEvent) => void;
  onResizeEnd: (event: ReactPointerEvent) => void;
}) {
  return (
    <th
      className={cn(sheetTh("relative px-0 py-0"), className)}
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <div className="flex h-8 items-center truncate whitespace-nowrap px-3">{children}</div>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-hidden
        className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize hover:bg-primary/30"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
      />
    </th>
  );
}
