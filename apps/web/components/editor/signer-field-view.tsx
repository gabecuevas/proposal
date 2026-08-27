"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { revealInputCaret } from "@/lib/editor/field-input-caret";
import { clamp01, locksSingleLineHeight, parseSignerFieldAttrs, type SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { commitSignerFieldPlaceholder, EMPTY_TEXT_PLACEHOLDER, storedFieldText } from "@/lib/editor/commit-signer-field-text";
import { PAGE_MARGIN_PX, pageAtVisualOffset, readPaperPageGapPx, readPaperPageHeightPx, visualTopForPage } from "@/lib/editor/page-geometry";
import { snapRect, snapResize, type AlignGuide, type FieldRect } from "@/lib/editor/field-snap";
import { FieldOptionsMenu } from "./creator/field-options-menu";
import {
  IconCheckbox,
  IconChevron,
  IconDate,
  IconDragHandle,
  IconDropdown,
  IconGear,
  IconInitials,
  IconSignature,
  IconTextField,
} from "./creator/creator-icons";
import { useSignerRecipients } from "./signer-field-context";

const MIN_W_PCT = 0.06;
const MIN_H_PCT = 0.022;
const FORM_CONTROL_SELECTOR = "input, textarea, select, button, [data-field-settings], [data-assign-pill], [data-field-gear]";

function typeLabel(type: string): string {
  switch (type) {
    case "signature":
      return "Signature";
    case "initial":
      return "Initials";
    case "date":
      return "Date";
    case "text":
      return "Text";
    case "checkbox":
      return "Checkbox";
    case "dropdown":
      return "Dropdown";
    default:
      return type;
  }
}

function FieldTypeIcon({ type, className }: { type: SignerFieldEditorType; className?: string }) {
  switch (type) {
    case "signature":
      return <IconSignature className={className} />;
    case "initial":
      return <IconInitials className={className} />;
    case "date":
      return <IconDate className={className} />;
    case "checkbox":
      return <IconCheckbox className={className} />;
    case "dropdown":
      return <IconDropdown className={className} />;
    default:
      return <IconTextField className={className} />;
  }
}

type Container = {
  element: HTMLElement;
  widthPx: number;
  heightPx: number;
  pageHeightPx: number;
  gapPx: number;
  isOverlay: boolean;
};

function resolveContainer(fieldEl: HTMLElement): Container | null {
  const overlay = fieldEl.closest("[data-field-overlay]") as HTMLElement | null;
  if (overlay) {
    const rect = overlay.getBoundingClientRect();
    return {
      element: overlay,
      widthPx: rect.width,
      heightPx: rect.height,
      pageHeightPx: readPaperPageHeightPx(overlay),
      gapPx: readPaperPageGapPx(overlay),
      isOverlay: true,
    };
  }
  const canvas = fieldEl.closest("[data-field-canvas]") as HTMLElement | null;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      element: canvas,
      widthPx: rect.width,
      heightPx: rect.height,
      pageHeightPx: rect.height,
      gapPx: 0,
      isOverlay: false,
    };
  }
  return null;
}

function visualY(page: number, yPct: number, pageHeightPx: number, gapPx: number): number {
  return visualTopForPage(page, pageHeightPx, gapPx) + yPct * pageHeightPx;
}

function collectSnapTargets(container: HTMLElement, selfId: string): FieldRect[] {
  const origin = container.getBoundingClientRect();
  const rects: FieldRect[] = [];
  const selector = [
    "[data-signer-field-id]",
    "[data-overlay-text-box-id]",
    ".creator-image-block",
    ".creator-text-box",
    "table",
    "hr",
    "h1",
    "h2",
    "h3",
    "[data-youtube-video]",
    "[data-node-type='quoteTable']",
  ].join(", ");
  for (const node of container.querySelectorAll(selector)) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node.getAttribute("data-signer-field-id") === selfId) {
      continue;
    }
    if (node.getAttribute("data-overlay-text-box-id") === selfId) {
      continue;
    }
    if (node.closest(".signer-field-node") && !node.hasAttribute("data-signer-field-id")) {
      continue;
    }
    if (node.closest(".overlay-text-box") && !node.hasAttribute("data-overlay-text-box-id")) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      continue;
    }
    rects.push({
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    });
  }
  return rects;
}

function FieldAlignGuides({ container, guides }: { container: HTMLElement; guides: AlignGuide[] }) {
  if (guides.length === 0) {
    return null;
  }
  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[60]" aria-hidden>
      {guides.map((guide, index) =>
        guide.axis === "x" ? (
          <div
            key={`x-${index}`}
            className="absolute top-0 bottom-0 w-px bg-primary"
            style={{ left: guide.position }}
          />
        ) : (
          <div
            key={`y-${index}`}
            className="absolute left-0 right-0 h-px bg-primary"
            style={{ top: guide.position }}
          />
        ),
      )}
    </div>,
    container,
  );
}

/**
 * Stop ProseMirror from seeing keys, but keep native `input` on the control so
 * React can update. Isolating `input` on an ancestor blocks React 17+ onChange.
 */
function useIsolateFieldEvents(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const stop = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(FORM_CONTROL_SELECTOR)) {
        event.stopPropagation();
      }
    };
    const types = ["keydown", "keyup", "keypress"];
    for (const type of types) {
      el.addEventListener(type, stop);
    }
    return () => {
      for (const type of types) {
        el.removeEventListener(type, stop);
      }
    };
  }, [ref]);
}

function FieldTextInput({
  placeholder,
  multiline,
  masked,
  onCommit,
  onFocus,
  onBlur,
}: {
  placeholder: string;
  multiline: boolean;
  masked: boolean;
  onCommit: (value: string) => void;
  onFocus?: () => void;
  onBlur?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const stored = storedFieldText(placeholder);
  const [value, setValue] = useState(stored);

  useEffect(() => {
    if (!focusedRef.current) {
      setValue(storedFieldText(placeholder));
    }
  }, [placeholder]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    const stop = (event: Event) => event.stopPropagation();
    const commit = () => {
      focusedRef.current = false;
      onCommitRef.current(el.value);
    };
    const onNativeInput = (event: Event) => {
      event.stopPropagation();
      setValue((event.target as HTMLInputElement | HTMLTextAreaElement).value);
    };
    const onNativeKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Enter" && !multiline && !event.shiftKey) {
        event.preventDefault();
        commit();
        el.blur();
      }
    };
    const onFocusOut = () => {
      commit();
    };
    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && el.contains(target)) {
        return;
      }
      onCommitRef.current(el.value);
    };
    el.addEventListener("input", onNativeInput);
    el.addEventListener("beforeinput", stop);
    el.addEventListener("keydown", onNativeKeyDown);
    el.addEventListener("keyup", stop);
    el.addEventListener("keypress", stop);
    el.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => {
      el.removeEventListener("input", onNativeInput);
      el.removeEventListener("beforeinput", stop);
      el.removeEventListener("keydown", onNativeKeyDown);
      el.removeEventListener("keyup", stop);
      el.removeEventListener("keypress", stop);
      el.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
    };
  }, [multiline]);

  const commitFromEl = (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    focusedRef.current = false;
    onCommit(event.currentTarget.value);
    onBlur?.(event);
  };

  const sharedClass =
    "h-full w-full bg-transparent px-1.5 py-0 text-[12px] leading-[18px] text-foreground caret-foreground outline-none placeholder:text-slate-400";

  const focusHandlers = {
    onPointerDown: (event: ReactPointerEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation();
    },
    onFocus: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      focusedRef.current = true;
      const el = event.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      onFocus?.();
      revealInputCaret(el, start, end);
      requestAnimationFrame(() => {
        if (document.activeElement !== el) {
          revealInputCaret(el, start, end);
        }
      });
    },
    onBlur: commitFromEl,
  };

  if (multiline) {
    return (
      <textarea
        ref={inputRef as RefObject<HTMLTextAreaElement>}
        rows={3}
        value={value}
        placeholder={EMPTY_TEXT_PLACEHOLDER}
        autoComplete="off"
        className={`${sharedClass} resize-none py-1`}
        onChange={(event) => setValue(event.target.value)}
        {...focusHandlers}
      />
    );
  }

  return (
    <input
      ref={inputRef as RefObject<HTMLInputElement>}
      type={masked ? "password" : "text"}
      value={value}
      placeholder={EMPTY_TEXT_PLACEHOLDER}
      autoComplete="off"
      className={sharedClass}
      onChange={(event) => setValue(event.target.value)}
      {...focusHandlers}
    />
  );
}

export function SignerFieldView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const recipients = useSignerRecipients();
  const rootRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const hoverLeaveTimer = useRef<number | null>(null);
  const [guides, setGuides] = useState<{ container: HTMLElement; lines: AlignGuide[] } | null>(null);
  const attrs = useMemo(
    () => parseSignerFieldAttrs(node.attrs as Record<string, unknown>, 0),
    [node.attrs],
  );
  const recipient = recipients.find((item) => item.id === attrs.recipientId);
  const recipientName = recipient?.name ?? attrs.recipientId;
  const hasAssignee = Boolean(attrs.recipientId && recipient);
  const chromeVisible = selected || hovered || menuOpen || assignOpen;
  const fieldActive = selected || chromeVisible;
  const lockHeight = locksSingleLineHeight(attrs.type, attrs.multiline);
  useIsolateFieldEvents(rootRef);
  useEffect(() => {
    return () => {
      if (hoverLeaveTimer.current != null) {
        window.clearTimeout(hoverLeaveTimer.current);
      }
    };
  }, []);
  useEffect(() => {
    const renderer = rootRef.current?.closest(".signer-field-renderer");
    if (!(renderer instanceof HTMLElement)) {
      return;
    }
    renderer.classList.toggle("is-field-chrome-up", chromeVisible);
    return () => {
      renderer.classList.remove("is-field-chrome-up");
    };
  }, [chromeVisible]);

  const posRef = useRef<number | null>(null);
  const resolvedPos = getPos();
  if (typeof resolvedPos === "number") {
    posRef.current = resolvedPos;
  }

  const selectThis = useCallback(
    (keepInputFocus = false) => {
      const pos = getPos();
      if (typeof pos !== "number") {
        return;
      }
      const { selection } = editor.state;
      const already = selection instanceof NodeSelection && selection.from === pos;
      if (!already) {
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)));
      }
      if (!keepInputFocus) {
        editor.view.focus();
      }
    },
    [editor, getPos],
  );

  const commitText = useCallback(
    (value: string) => {
      const live = getPos();
      const pos = typeof live === "number" ? live : posRef.current;
      if (typeof pos !== "number") {
        return;
      }
      commitSignerFieldPlaceholder(editor, pos, value);
    },
    [editor, getPos],
  );

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest("[data-field-gear], [data-assign-pill], [data-resize-handle], [data-field-settings]")) {
        return;
      }
      const fromInput = Boolean(target.closest("input, textarea"));
      if (fromInput) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectThis();

      const container = resolveContainer(event.currentTarget as HTMLElement);
      if (!container || container.widthPx <= 0) {
        return;
      }

      const startLeft = attrs.xPct * container.widthPx;
      const startTop = visualY(attrs.page, attrs.yPct, container.pageHeightPx, container.gapPx);
      const width = attrs.wPct * container.widthPx;
      const height = attrs.hPct * container.pageHeightPx;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const others = collectSnapTargets(container.element, attrs.fieldId);

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const next = snapRect(
          {
            left: startLeft + (moveEvent.clientX - startClientX),
            top: startTop + (moveEvent.clientY - startClientY),
            width,
            height,
          },
          others,
          { width: container.widthPx, height: container.heightPx, margin: PAGE_MARGIN_PX },
        );
        setGuides({ container: container.element, lines: next.guides });
        const xPct = clamp01(next.left / container.widthPx);
        if (container.isOverlay) {
          const page = pageAtVisualOffset(next.top, container.pageHeightPx, container.gapPx);
          const yPct = Math.min(
            Math.max(0, 1 - attrs.hPct),
            (next.top - visualTopForPage(page, container.pageHeightPx, container.gapPx)) / container.pageHeightPx,
          );
          updateAttributes({ xPct: Math.min(xPct, 1 - attrs.wPct), yPct, page });
        } else {
          updateAttributes({
            xPct: Math.min(xPct, 1 - attrs.wPct),
            yPct: Math.min(Math.max(0, 1 - attrs.hPct), next.top / container.heightPx),
            page: 0,
          });
        }
      };

      const onUp = () => {
        setGuides(null);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [attrs.fieldId, attrs.hPct, attrs.page, attrs.wPct, attrs.xPct, attrs.yPct, selectThis, updateAttributes],
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectThis();

      const container = resolveContainer(event.currentTarget as HTMLElement);
      if (!container || container.widthPx <= 0) {
        return;
      }

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startW = attrs.wPct * container.widthPx;
      const startH = attrs.hPct * container.pageHeightPx;
      const left = attrs.xPct * container.widthPx;
      const top = visualY(attrs.page, attrs.yPct, container.pageHeightPx, container.gapPx);
      const others = collectSnapTargets(container.element, attrs.fieldId);

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const width = Math.max(MIN_W_PCT * container.widthPx, startW + (moveEvent.clientX - startClientX));
        const height = lockHeight
          ? startH
          : Math.max(MIN_H_PCT * container.pageHeightPx, startH + (moveEvent.clientY - startClientY));
        const next = snapResize(
          { left, top, width, height },
          others,
          { width: container.widthPx, height: container.heightPx, margin: PAGE_MARGIN_PX },
          { lockHeight },
        );
        setGuides({ container: container.element, lines: next.guides });
        updateAttributes({
          wPct: Math.min(1 - attrs.xPct, Math.max(MIN_W_PCT, next.width / container.widthPx)),
          hPct: lockHeight
            ? attrs.hPct
            : Math.min(1 - attrs.yPct, Math.max(MIN_H_PCT, next.height / container.pageHeightPx)),
        });
      };

      const onUp = () => {
        setGuides(null);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [attrs.fieldId, attrs.hPct, attrs.page, attrs.wPct, attrs.xPct, attrs.yPct, lockHeight, selectThis, updateAttributes],
  );

  const positionVars = {
    "--field-x": attrs.xPct,
    "--field-y": attrs.yPct,
    "--field-w": attrs.wPct,
    "--field-h": attrs.hPct,
    "--field-page": attrs.page,
  } as CSSProperties;

  const placeholder = attrs.placeholder || (attrs.type === "text" ? "Enter text..." : typeLabel(attrs.type));

  return (
    <NodeViewWrapper
      className={`signer-field-node overflow-visible ${chromeVisible ? "z-40" : "z-20"}`}
      style={positionVars}
      data-signer-field-id={attrs.fieldId}
      data-field-page={attrs.page}
      contentEditable={false}
      onPointerEnter={() => {
        if (hoverLeaveTimer.current != null) {
          window.clearTimeout(hoverLeaveTimer.current);
          hoverLeaveTimer.current = null;
        }
        setHovered(true);
      }}
      onPointerLeave={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && (rootRef.current?.contains(next) || (next instanceof Element && next.closest("[data-field-settings]")))) {
          return;
        }
        hoverLeaveTimer.current = window.setTimeout(() => {
          setHovered(false);
          hoverLeaveTimer.current = null;
        }, 160);
      }}
      onPointerDown={onDragPointerDown}
    >
      <div ref={rootRef} className="relative h-full w-full">
      {guides ? <FieldAlignGuides container={guides.container} guides={guides.lines} /> : null}

      {fieldActive ? (
        <span
          data-drag-handle
          role="img"
          aria-label="Move field"
          title="Drag to move"
          className="absolute left-0 top-1/2 z-30 flex h-full -translate-x-full -translate-y-1/2 cursor-grab items-center pr-1 active:cursor-grabbing"
        >
          <IconDragHandle className="h-3.5 w-3.5 text-slate-400" />
        </span>
      ) : null}

      {chromeVisible ? (
        <div className="absolute inset-x-0 bottom-full z-50 flex items-center">
          {hasAssignee ? (
            <div className="relative" data-assign-pill>
              <button
                type="button"
                className="flex h-5 max-w-[140px] items-center gap-0.5 rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground shadow-sm"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectThis();
                  setAssignOpen((open) => !open);
                  setMenuOpen(false);
                }}
              >
                <span className="truncate">{recipientName}</span>
                <IconChevron className="h-2.5 w-2.5 shrink-0" />
              </button>
              {assignOpen ? (
                <div className="absolute left-0 top-6 z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-surface py-0.5 shadow-xl">
                  {recipients.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex w-full items-center justify-between px-2 py-1 text-left text-[11px] hover:bg-slate-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateAttributes({ recipientId: item.id });
                        setAssignOpen(false);
                      }}
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="ml-2 text-[9px] text-primary">
                        {item.role === "sender" ? "Sender" : item.role === "approver" ? "Approver" : "Signer"}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flex w-full items-center px-2 py-1 text-left text-[11px] text-muted hover:bg-slate-50"
                    onClick={(event) => {
                      event.stopPropagation();
                      updateAttributes({ recipientId: "" });
                      setAssignOpen(false);
                    }}
                  >
                    Unassigned
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          <div data-field-gear className="relative ml-auto">
            <button
              ref={gearRef}
              type="button"
              aria-label="Field options"
              title="Field options"
              aria-expanded={menuOpen}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-95"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                selectThis();
                setMenuOpen((open) => !open);
                setAssignOpen(false);
              }}
            >
              <IconGear className="h-3.5 w-3.5" />
            </button>
            {menuOpen ? (
              <FieldOptionsMenu
                editor={editor}
                anchorRef={gearRef}
                getPos={() => {
                  const pos = getPos();
                  return typeof pos === "number" ? pos : undefined;
                }}
                onClose={() => setMenuOpen(false)}
              />
            ) : null}
          </div>
          <span className="absolute inset-x-0 top-full h-2" aria-hidden />
        </div>
      ) : null}

      <div
        className={`flex h-full min-h-0 w-full items-center rounded-[2px] border bg-white ${
          fieldActive ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-primary/70"
        }`}
      >
        {attrs.type === "text" ? (
          <FieldTextInput
            placeholder={attrs.placeholder}
            multiline={attrs.multiline}
            masked={attrs.maskValue}
            onCommit={commitText}
            onFocus={() => {
              selectThis(true);
            }}
          />
        ) : attrs.type === "checkbox" ? (
          <label className="flex h-full w-full items-center gap-2 px-2 text-[12px] text-slate-600">
            <input type="checkbox" tabIndex={-1} readOnly className="accent-primary" />
            <span className="truncate">{attrs.label || "Checkbox"}</span>
          </label>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 px-2 text-[12px] text-slate-400">
            <FieldTypeIcon type={attrs.type} className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{placeholder}</span>
          </span>
        )}
      </div>

      {chromeVisible ? (
        <span
          data-resize-handle
          role="presentation"
          aria-label={lockHeight ? "Resize field width" : "Resize field"}
          title={lockHeight ? "Drag to set width" : "Drag to resize"}
          onPointerDown={onResizePointerDown}
          className="absolute -bottom-1.5 -right-1.5 z-30 h-3 w-3 rounded-full border-2 border-white bg-primary shadow-sm"
          style={{ cursor: lockHeight ? "ew-resize" : "nwse-resize" }}
        />
      ) : null}
      </div>
    </NodeViewWrapper>
  );
}
