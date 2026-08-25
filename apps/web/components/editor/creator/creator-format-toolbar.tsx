"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clearFormatting,
  getEditorFormatState,
  indentSelection,
  outdentSelection,
  redo,
  runClipboardAction,
  selectAll,
  setAlignment,
  setBlockStyle,
  setFontFamily,
  setFontSize,
  setHighlightColor,
  setLineHeight,
  setLinkHref,
  setTextColor,
  toggleBold,
  toggleBulletList,
  toggleItalic,
  toggleOrderedList,
  toggleStrike,
  toggleUnderline,
  undo,
  unsetLink,
  type BlockStyleId,
} from "@/lib/editor/commands/editor-commands";
import {
  BLOCK_STYLES,
  FONT_FAMILIES,
  HIGHLIGHT_COLORS,
  LINE_HEIGHTS,
  TEXT_COLORS,
} from "@/lib/editor/commands/format-presets";
import { FONT_SIZES } from "@/lib/editor/extensions/font-size";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import {
  IconAlignCenter,
  IconAlignJustify,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconHighlight,
  IconIndent,
  IconItalic,
  IconLineSpacing,
  IconLink,
  IconListBullet,
  IconListOrdered,
  IconOutdent,
  IconPalette,
  IconRedo,
  IconStrike,
  IconUnderline,
  IconUndo,
} from "./creator-icons";

type Props = {
  editor: Editor | null;
};

type PopoverId = "color" | "highlight" | "link" | "more" | "line" | null;

export function CreatorFormatToolbar({ editor }: Props) {
  const tick = useEditorEventTick(editor);
  const [open, setOpen] = useState<PopoverId>(null);
  const [linkValue, setLinkValue] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  void tick;

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  if (!editor) {
    return (
      <div className="creator-format-toolbar flex h-10 shrink-0 items-center border-b border-border bg-surface px-2 text-xs text-muted">
        Formatting tools appear once the document loads.
      </div>
    );
  }

  const state = getEditorFormatState(editor);

  function keepFocus(event: React.MouseEvent) {
    event.preventDefault();
  }

  return (
    <div
      ref={barRef}
      className="creator-format-toolbar flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-surface px-2"
      onMouseDown={keepFocus}
    >
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => undo(editor)}>
        <IconUndo className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => redo(editor)}>
        <IconRedo className="h-3.5 w-3.5" />
      </ToolButton>
      <Divider />

      <label className="sr-only" htmlFor="creator-block-style">
        Paragraph style
      </label>
      <select
        id="creator-block-style"
        className="h-7 max-w-[8.5rem] rounded border border-transparent bg-transparent px-1 text-xs text-foreground hover:border-border"
        value={state.blockStyle}
        onChange={(event) => setBlockStyle(editor, event.target.value as BlockStyleId)}
      >
        {BLOCK_STYLES.map((style) => (
          <option key={style.id} value={style.id}>
            {style.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="creator-font-family">
        Font
      </label>
      <select
        id="creator-font-family"
        className="h-7 max-w-[7.5rem] rounded border border-transparent bg-transparent px-1 text-xs text-foreground hover:border-border"
        value={state.fontFamily}
        onChange={(event) => setFontFamily(editor, event.target.value)}
      >
        {FONT_FAMILIES.map((font) => (
          <option key={font.id || "default"} value={font.id}>
            {font.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="creator-toolbar-font-size">
        Font size
      </label>
      <select
        id="creator-toolbar-font-size"
        className="h-7 w-14 rounded border border-transparent bg-transparent px-1 text-xs text-foreground hover:border-border"
        value={state.fontSize}
        onChange={(event) => setFontSize(editor, event.target.value)}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
      </select>
      <Divider />

      <ToolButton label="Bold" active={state.bold} onClick={() => toggleBold(editor)}>
        <IconBold className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => toggleItalic(editor)}>
        <IconItalic className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Underline" active={state.underline} onClick={() => toggleUnderline(editor)}>
        <IconUnderline className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Strikethrough" active={state.strike} onClick={() => toggleStrike(editor)}>
        <IconStrike className="h-3.5 w-3.5" />
      </ToolButton>

      <PopoverWrap
        open={open === "color"}
        button={
          <ToolButton
            label="Text color"
            active={Boolean(state.color)}
            onClick={() => setOpen(open === "color" ? null : "color")}
          >
            <span className="flex flex-col items-center">
              <IconPalette className="h-3.5 w-3.5" />
              <span className="mt-px h-0.5 w-3.5 rounded-sm" style={{ background: state.color || "#0f172a" }} />
            </span>
          </ToolButton>
        }
      >
        <SwatchGrid
          colors={TEXT_COLORS}
          selected={state.color}
          onPick={(color) => {
            setTextColor(editor, color);
            setOpen(null);
          }}
          onClear={() => {
            setTextColor(editor, "");
            setOpen(null);
          }}
        />
      </PopoverWrap>

      <PopoverWrap
        open={open === "highlight"}
        button={
          <ToolButton
            label="Highlight"
            active={Boolean(state.highlight)}
            onClick={() => setOpen(open === "highlight" ? null : "highlight")}
          >
            <IconHighlight className="h-3.5 w-3.5" />
          </ToolButton>
        }
      >
        <SwatchGrid
          colors={HIGHLIGHT_COLORS}
          selected={state.highlight}
          onPick={(color) => {
            setHighlightColor(editor, color);
            setOpen(null);
          }}
          onClear={() => {
            setHighlightColor(editor, "");
            setOpen(null);
          }}
        />
      </PopoverWrap>

      <PopoverWrap
        open={open === "link"}
        button={
          <ToolButton
            label="Link"
            active={Boolean(state.link)}
            onClick={() => {
              setLinkValue(state.link);
              setOpen(open === "link" ? null : "link");
            }}
          >
            <IconLink className="h-3.5 w-3.5" />
          </ToolButton>
        }
      >
        <form
          className="flex w-56 flex-col gap-1.5 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            setLinkHref(editor, linkValue);
            setOpen(null);
          }}
        >
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted" htmlFor="creator-link-href">
            Link
          </label>
          <input
            id="creator-link-href"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https://"
            className="rounded border border-border bg-background px-2 py-1 text-xs outline-none ring-primary/15 focus:ring-2"
          />
          <div className="flex gap-1">
            <button type="submit" className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
              Apply
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-muted hover:bg-slate-100"
              onClick={() => {
                unsetLink(editor);
                setOpen(null);
              }}
            >
              Remove
            </button>
          </div>
        </form>
      </PopoverWrap>
      <Divider />

      <ToolButton label="Align left" active={state.align === "left"} onClick={() => setAlignment(editor, "left")}>
        <IconAlignLeft className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton
        label="Align center"
        active={state.align === "center"}
        onClick={() => setAlignment(editor, "center")}
      >
        <IconAlignCenter className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Align right" active={state.align === "right"} onClick={() => setAlignment(editor, "right")}>
        <IconAlignRight className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton
        label="Justify"
        active={state.align === "justify"}
        onClick={() => setAlignment(editor, "justify")}
      >
        <IconAlignJustify className="h-3.5 w-3.5" />
      </ToolButton>
      <Divider />

      <ToolButton label="Bulleted list" active={state.bulletList} onClick={() => toggleBulletList(editor)}>
        <IconListBullet className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Numbered list" active={state.orderedList} onClick={() => toggleOrderedList(editor)}>
        <IconListOrdered className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Decrease indent" onClick={() => outdentSelection(editor)}>
        <IconOutdent className="h-3.5 w-3.5" />
      </ToolButton>
      <ToolButton label="Increase indent" onClick={() => indentSelection(editor)}>
        <IconIndent className="h-3.5 w-3.5" />
      </ToolButton>

      <PopoverWrap
        open={open === "line"}
        button={
          <ToolButton
            label="Line spacing"
            active={Boolean(state.lineHeight)}
            onClick={() => setOpen(open === "line" ? null : "line")}
          >
            <IconLineSpacing className="h-3.5 w-3.5" />
          </ToolButton>
        }
      >
        <div className="py-1">
          {LINE_HEIGHTS.map((item) => (
            <button
              key={item.id || "default"}
              type="button"
              className={`block w-full px-3 py-1.5 text-left text-xs ${
                state.lineHeight === item.id ? "bg-primary/10 text-primary" : "hover:bg-slate-50"
              }`}
              onClick={() => {
                setLineHeight(editor, item.id);
                setOpen(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </PopoverWrap>
      <Divider />

      <PopoverWrap
        open={open === "more"}
        button={
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-muted hover:bg-slate-100 hover:text-foreground"
            aria-expanded={open === "more"}
            onClick={() => setOpen(open === "more" ? null : "more")}
          >
            More
          </button>
        }
      >
        <div className="min-w-40 py-1 text-xs">
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              void runClipboardAction(editor, "cut");
              setOpen(null);
            }}
          >
            Cut
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              void runClipboardAction(editor, "copy");
              setOpen(null);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              selectAll(editor);
              setOpen(null);
            }}
          >
            Select all
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
            onClick={() => {
              clearFormatting(editor);
              setOpen(null);
            }}
          >
            Clear formatting
          </button>
        </div>
      </PopoverWrap>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded disabled:opacity-30 ${
        active ? "bg-primary/10 text-primary" : "text-muted hover:bg-slate-100 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PopoverWrap({
  open,
  button,
  children,
}: {
  open: boolean;
  button: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {button}
      {open ? (
        <div className="absolute left-0 top-8 z-40 rounded-md border border-border bg-surface shadow-lg">{children}</div>
      ) : null}
    </div>
  );
}

function SwatchGrid({
  colors,
  selected,
  onPick,
  onClear,
}: {
  colors: readonly string[];
  selected: string;
  onPick: (color: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="w-40 p-2">
      <div className="grid grid-cols-5 gap-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            className={`h-5 w-5 rounded-sm border ${
              selected === color ? "border-primary ring-1 ring-primary" : "border-border"
            }`}
            style={{ background: color }}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
      <button type="button" className="mt-1.5 text-[11px] text-muted hover:text-foreground" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}
