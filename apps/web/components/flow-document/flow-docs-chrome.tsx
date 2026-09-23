"use client";

import type { Editor } from "@tiptap/core";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import {
  clearFormatting,
  getEditorFormatState,
  indentSelection,
  outdentSelection,
  redo,
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
  toggleUnderline,
  undo,
  unsetLink,
} from "@/lib/editor/commands/editor-commands";
import { HIGHLIGHT_COLORS, LINE_HEIGHTS, TEXT_COLORS, type BlockStyleId } from "@/lib/editor/commands/format-presets";
import {
  cssFontSizeToPt,
  FLOW_DEFAULT_FONT,
  FLOW_FONT_SIZES_PT,
  FLOW_GOOGLE_FONTS,
  fontSizeToCss,
} from "@/lib/flow-document/google-fonts";
import { runFlowClipboard } from "@/lib/flow-document/clipboard";
import {
  distributeFlowTableColumns,
  openFlowTableOptionsEvent,
} from "@/lib/flow-document/table-commands";
import { formatEditorSaveStatus, isEditorSaving } from "@/lib/editor/autosave";
import {
  FlowActionsMenu,
  type FlowActionsMenuItem,
} from "@/components/flow-document/flow-actions-menu";

type MenuId = "file" | "edit" | "view" | "insert" | "format" | "tools" | "help" | null;

type PopoverId =
  | "style"
  | "font"
  | "size"
  | "color"
  | "highlight"
  | "align"
  | "line"
  | "link"
  | "zoom"
  | "menus"
  | null;

type Props = {
  editor: Editor | null;
  name: string;
  onNameChange: (name: string) => void;
  saveStatus: string;
  statusLabel: string;
  locked?: boolean;
  closeHref?: string;
  onSave: () => void;
  onPrint: () => void;
  onInsertImage: () => void;
  onInsertTable: () => void;
  onInsertPageBreak: () => void;
  onAddComment: () => void;
  /** Collaboration row — Add Contact / Preview / PDF / Copy URL (documents only). */
  onAddContact?: () => void;
  onPreview?: () => void;
  onDownloadPdf?: () => void;
  onCopyUrl?: () => void;
  copyUrlLabel?: string;
  documentActionsDisabled?: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showRulers?: boolean;
  onShowRulersChange?: (show: boolean) => void;
  actionsItems?: FlowActionsMenuItem[];
};

const BLOCK_STYLES: { id: BlockStyleId | "h4" | "h5" | "h6"; label: string }[] = [
  { id: "paragraph", label: "Normal text" },
  { id: "h1", label: "Heading 1" },
  { id: "h2", label: "Heading 2" },
  { id: "h3", label: "Heading 3" },
  { id: "h4", label: "Heading 4" },
  { id: "h5", label: "Heading 5" },
  { id: "h6", label: "Heading 6" },
];

const ZOOM_OPTIONS = [50, 75, 90, 100, 125, 150, 200];

type PaintClipboard = {
  marks: Record<string, unknown>;
  attrs: { textAlign?: string; lineHeight?: string };
};

export function FlowDocsChrome({
  editor,
  name,
  onNameChange,
  saveStatus,
  statusLabel,
  locked = false,
  closeHref = "/app/documents",
  onSave,
  onPrint,
  onInsertImage,
  onInsertTable,
  onInsertPageBreak,
  onAddComment,
  onAddContact,
  onPreview,
  onDownloadPdf,
  onCopyUrl,
  copyUrlLabel = "Copy URL",
  documentActionsDisabled = false,
  zoom,
  onZoomChange,
  showRulers = true,
  onShowRulersChange,
  actionsItems,
}: Props) {
  const tick = useEditorEventTick(editor);
  void tick;
  const rootRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuId>(null);
  const [popover, setPopover] = useState<PopoverId>(null);
  const [linkValue, setLinkValue] = useState("");
  const [menuQuery, setMenuQuery] = useState("");
  const [paintMode, setPaintMode] = useState(false);
  const paintRef = useRef<PaintClipboard | null>(null);
  const format = editor ? getEditorFormatState(editor) : null;

  useEffect(() => {
    if (!menu && !popover) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMenu(null);
        setPopover(null);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(null);
        setPopover(null);
        setPaintMode(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, popover]);

  useEffect(() => {
    if (!editor || !paintMode || !paintRef.current) {
      return;
    }
    const clip = paintRef.current;
    const apply = () => {
      const chain = editor.chain().focus();
      if (clip.marks.bold) {
        chain.setBold();
      } else {
        chain.unsetBold();
      }
      if (clip.marks.italic) {
        chain.setItalic();
      } else {
        chain.unsetItalic();
      }
      if (clip.marks.underline) {
        chain.setUnderline();
      } else {
        chain.unsetUnderline();
      }
      if (typeof clip.marks.fontFamily === "string" && clip.marks.fontFamily) {
        chain.setFontFamily(clip.marks.fontFamily);
      }
      if (typeof clip.marks.fontSize === "string" && clip.marks.fontSize) {
        chain.setFontSize(clip.marks.fontSize);
      }
      if (typeof clip.marks.color === "string" && clip.marks.color) {
        chain.setColor(clip.marks.color);
      }
      if (typeof clip.marks.highlight === "string" && clip.marks.highlight) {
        chain.setHighlight({ color: clip.marks.highlight });
      }
      if (clip.attrs.textAlign) {
        chain.setTextAlign(clip.attrs.textAlign);
      }
      if (clip.attrs.lineHeight) {
        chain.setLineHeight(clip.attrs.lineHeight);
      }
      chain.run();
      setPaintMode(false);
      paintRef.current = null;
    };
    editor.on("selectionUpdate", apply);
    return () => {
      editor.off("selectionUpdate", apply);
    };
  }, [editor, paintMode]);

  const currentFontLabel = useMemo(() => {
    const family = format?.fontFamily || FLOW_DEFAULT_FONT.family;
    const match = FLOW_GOOGLE_FONTS.find((f) => f.family === family || family.includes(f.label));
    return match?.label ?? "Arial";
  }, [format?.fontFamily]);

  const currentSizePt = cssFontSizeToPt(format?.fontSize || "11pt");
  const styleLabel =
    BLOCK_STYLES.find((s) => s.id === format?.blockStyle)?.label ??
    (editor?.isActive("heading", { level: 4 })
      ? "Heading 4"
      : editor?.isActive("heading", { level: 5 })
        ? "Heading 5"
        : editor?.isActive("heading", { level: 6 })
          ? "Heading 6"
          : "Normal text");

  function toggleMenu(id: MenuId) {
    setPopover(null);
    setMenu((current) => (current === id ? null : id));
  }

  function togglePopover(id: PopoverId) {
    setMenu(null);
    setPopover((current) => (current === id ? null : id));
  }

  function run(action: () => void) {
    if (locked || !editor) {
      return;
    }
    action();
    setMenu(null);
    setPopover(null);
  }

  function applyBlockStyle(id: (typeof BLOCK_STYLES)[number]["id"]) {
    run(() => {
      if (id === "paragraph" || id === "h1" || id === "h2" || id === "h3") {
        setBlockStyle(editor!, id);
        return;
      }
      const level = Number(id.slice(1)) as 4 | 5 | 6;
      editor!.chain().focus().setHeading({ level }).run();
    });
  }

  function bumpFontSize(delta: number) {
    run(() => {
      const current = Number(currentSizePt) || 11;
      const next = Math.min(96, Math.max(8, current + delta));
      setFontSize(editor!, fontSizeToCss(String(next)));
    });
  }

  function capturePaintFormat() {
    if (!editor) {
      return;
    }
    const state = getEditorFormatState(editor);
    paintRef.current = {
      marks: {
        bold: state.bold,
        italic: state.italic,
        underline: state.underline,
        fontFamily: state.fontFamily || FLOW_DEFAULT_FONT.family,
        fontSize: state.fontSize || "11pt",
        color: state.color || "#000000",
        highlight: state.highlight,
      },
      attrs: {
        textAlign: state.align || "left",
        lineHeight: state.lineHeight || undefined,
      },
    };
    setPaintMode(true);
    setMenu(null);
    setPopover(null);
  }

  function copySelection() {
    void runFlowClipboard(editor, "copy");
  }

  function cutSelection() {
    void runFlowClipboard(editor, "cut");
  }

  async function pasteClipboard() {
    if (locked || !editor) {
      return;
    }
    await runFlowClipboard(editor, "paste");
    setMenu(null);
  }

  const menuItems = useMemo(() => {
    const all: { menu: Exclude<MenuId, null>; label: string; action: () => void }[] = [
      { menu: "file", label: "Save", action: onSave },
      { menu: "file", label: "Print", action: onPrint },
      { menu: "edit", label: "Undo", action: () => undo(editor!) },
      { menu: "edit", label: "Redo", action: () => redo(editor!) },
      { menu: "edit", label: "Cut", action: cutSelection },
      { menu: "edit", label: "Copy", action: copySelection },
      { menu: "edit", label: "Paste", action: () => void pasteClipboard() },
      { menu: "edit", label: "Select all", action: () => selectAll(editor!) },
      { menu: "edit", label: "Clear formatting", action: () => clearFormatting(editor!) },
      { menu: "insert", label: "Image", action: onInsertImage },
      { menu: "insert", label: "Link", action: () => togglePopover("link") },
      { menu: "insert", label: "Table", action: onInsertTable },
      { menu: "insert", label: "Page break", action: onInsertPageBreak },
      { menu: "insert", label: "Horizontal line", action: () => editor?.chain().focus().setHorizontalRule().run() },
      { menu: "format", label: "Bold", action: () => toggleBold(editor!) },
      { menu: "format", label: "Italic", action: () => toggleItalic(editor!) },
      { menu: "format", label: "Underline", action: () => toggleUnderline(editor!) },
      { menu: "tools", label: "Word count", action: () => showWordCount(editor) },
    ];
    if (!menuQuery.trim()) {
      return all;
    }
    const q = menuQuery.trim().toLowerCase();
    return all.filter((item) => item.label.toLowerCase().includes(q));
    // Clipboard actions close over the current editor; listing them as deps would
    // invalidate this memo every render because they are plain function declarations.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clipboard fns intentionally omitted
  }, [editor, menuQuery, onInsertImage, onInsertPageBreak, onInsertTable, onPrint, onSave]);

  return (
    <div ref={rootRef} className="flow-docs-chrome shrink-0 border-b border-[#dadce0] bg-white">
      <div className="h-[7px] w-full bg-[#002868]" aria-hidden />
      {/* Title row */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <Link
          href={closeHref}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full hover:bg-[#f1f3f4]"
          title="Back to Documents"
          aria-label="Back to Documents"
        >
          <DocsIcon />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={locked}
              className="min-w-[12rem] max-w-md truncate border-0 bg-transparent px-1 text-[18px] leading-7 text-[#202124] outline-none hover:border-b hover:border-[#dadce0] focus:border-b focus:border-[#1a73e8]"
              placeholder="Untitled document"
              aria-label="Document title"
            />
            <span className="hidden text-xs text-[#5f6368] sm:inline">{statusLabel}</span>
            <span className="text-xs text-[#5f6368]">
              {isEditorSaving(saveStatus) ? "Saving…" : formatEditorSaveStatus(saveStatus)}
            </span>
          </div>
          {/* Menu bar */}
          <div className="relative mt-0.5 flex flex-wrap items-center gap-0.5 text-[14px] text-[#202124]">
            {(
              [
                ["file", "File"],
                ["edit", "Edit"],
                ["view", "View"],
                ["insert", "Insert"],
                ["format", "Format"],
                ["tools", "Tools"],
                ["help", "Help"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={locked && id !== "help" && id !== "view"}
                className={cn(
                  "rounded px-2 py-0.5 hover:bg-[#f1f3f4] disabled:opacity-40",
                  menu === id && "bg-[#e8f0fe] text-[#1967d2]",
                )}
                onClick={() => toggleMenu(id)}
              >
                {label}
              </button>
            ))}
            {menu ? (
              <div className="absolute left-0 top-full z-50 mt-1 min-w-[14rem] rounded-md border border-[#dadce0] bg-white py-1 shadow-lg">
                {menu === "file" ? (
                  <>
                    <MenuItem label="Save" shortcut="⌘S" onClick={() => run(onSave)} />
                    <MenuItem label="Print" shortcut="⌘P" onClick={() => run(onPrint)} />
                    <MenuItem label="Page setup…" onClick={() => setMenu(null)} disabled />
                    <div className="my-1 border-t border-[#eee]" />
                    <MenuItem
                      label="Close"
                      onClick={() => {
                        window.location.href = closeHref;
                      }}
                    />
                  </>
                ) : null}
                {menu === "edit" ? (
                  <>
                    <MenuItem label="Undo" shortcut="⌘Z" onClick={() => run(() => undo(editor!))} />
                    <MenuItem label="Redo" shortcut="⌘⇧Z" onClick={() => run(() => redo(editor!))} />
                    <div className="my-1 border-t border-[#eee]" />
                    <MenuItem label="Cut" shortcut="⌘X" onClick={cutSelection} />
                    <MenuItem label="Copy" shortcut="⌘C" onClick={copySelection} />
                    <MenuItem label="Paste" shortcut="⌘V" onClick={() => void pasteClipboard()} />
                    <MenuItem label="Select all" shortcut="⌘A" onClick={() => run(() => selectAll(editor!))} />
                    <div className="my-1 border-t border-[#eee]" />
                    <MenuItem label="Clear formatting" onClick={() => run(() => clearFormatting(editor!))} />
                  </>
                ) : null}
                {menu === "view" ? (
                  <>
                    <MenuItem
                      label={showRulers ? "Hide ruler" : "Show ruler"}
                      onClick={() => {
                        onShowRulersChange?.(!showRulers);
                        setMenu(null);
                      }}
                    />
                    <div className="my-1 border-t border-[#eee]" />
                    {ZOOM_OPTIONS.map((value) => (
                      <MenuItem
                        key={value}
                        label={`${value}%`}
                        onClick={() => {
                          onZoomChange(value);
                          setMenu(null);
                        }}
                      />
                    ))}
                  </>
                ) : null}
                {menu === "insert" ? (
                  <>
                    <MenuItem label="Image" onClick={() => run(onInsertImage)} />
                    <MenuItem
                      label="Header"
                      onClick={() => {
                        window.dispatchEvent(new Event("flow-open-header"));
                        setMenu(null);
                      }}
                    />
                    <MenuItem
                      label="Footer"
                      onClick={() => {
                        window.dispatchEvent(new Event("flow-open-footer"));
                        setMenu(null);
                      }}
                    />
                    <MenuItem
                      label="Link"
                      onClick={() => {
                        setLinkValue(format?.link ?? "");
                        togglePopover("link");
                      }}
                    />
                    <MenuItem label="Table" onClick={() => run(onInsertTable)} />
                    <MenuItem label="Page break" onClick={() => run(onInsertPageBreak)} />
                    <MenuItem
                      label="Horizontal line"
                      onClick={() => run(() => editor?.chain().focus().setHorizontalRule().run())}
                    />
                    <MenuItem label="Comment" onClick={() => run(onAddComment)} />
                  </>
                ) : null}
                {menu === "format" ? (
                  <>
                    <MenuItem label="Bold" onClick={() => run(() => toggleBold(editor!))} />
                    <MenuItem label="Italic" onClick={() => run(() => toggleItalic(editor!))} />
                    <MenuItem label="Underline" onClick={() => run(() => toggleUnderline(editor!))} />
                    <div className="my-1 border-t border-[#eee]" />
                    <MenuItem label="Align left" onClick={() => run(() => setAlignment(editor!, "left"))} />
                    <MenuItem label="Align center" onClick={() => run(() => setAlignment(editor!, "center"))} />
                    <MenuItem label="Align right" onClick={() => run(() => setAlignment(editor!, "right"))} />
                    <MenuItem label="Justify" onClick={() => run(() => setAlignment(editor!, "justify"))} />
                    <div className="my-1 border-t border-[#eee]" />
                    <MenuItem label="Bulleted list" onClick={() => run(() => toggleBulletList(editor!))} />
                    <MenuItem label="Numbered list" onClick={() => run(() => toggleOrderedList(editor!))} />
                    <MenuItem
                      label="Checklist"
                      onClick={() => run(() => editor?.chain().focus().toggleTaskList().run())}
                    />
                    <MenuItem label="Increase indent" onClick={() => run(() => indentSelection(editor!))} />
                    <MenuItem label="Decrease indent" onClick={() => run(() => outdentSelection(editor!))} />
                    <div className="my-1 border-t border-[#eee]" />
                    <MenuItem
                      label="Insert row above"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().addRowBefore().run())}
                    />
                    <MenuItem
                      label="Insert row below"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().addRowAfter().run())}
                    />
                    <MenuItem
                      label="Insert column left"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().addColumnBefore().run())}
                    />
                    <MenuItem
                      label="Insert column right"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().addColumnAfter().run())}
                    />
                    <MenuItem
                      label="Delete row"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().deleteRow().run())}
                    />
                    <MenuItem
                      label="Delete column"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().deleteColumn().run())}
                    />
                    <MenuItem
                      label="Delete table"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().deleteTable().run())}
                    />
                    <MenuItem
                      label="Merge cells"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().mergeCells().run())}
                    />
                    <MenuItem
                      label="Split cell"
                      disabled={!format?.inTable}
                      onClick={() => run(() => editor?.chain().focus().splitCell().run())}
                    />
                    <MenuItem
                      label="Distribute columns"
                      disabled={!format?.inTable}
                      onClick={() => run(() => distributeFlowTableColumns(editor!))}
                    />
                    <MenuItem
                      label="Table options"
                      disabled={!format?.inTable}
                      onClick={() => {
                        openFlowTableOptionsEvent();
                        setMenu(null);
                      }}
                    />
                    <div className="my-1 border-t border-[#eee]" />
                    <MenuItem
                      label="Headers & footers"
                      onClick={() => {
                        window.dispatchEvent(new Event("flow-open-headers-footers-modal"));
                        setMenu(null);
                      }}
                    />
                  </>
                ) : null}
                {menu === "tools" ? (
                  <>
                    <MenuItem label="Spelling (browser)" onClick={() => setMenu(null)} />
                    <MenuItem label="Word count" onClick={() => run(() => showWordCount(editor))} />
                    <MenuItem label="Paint format" onClick={capturePaintFormat} />
                  </>
                ) : null}
                {menu === "help" ? (
                  <>
                    <MenuItem
                      label="Keyboard shortcuts"
                      onClick={() => {
                        window.alert(
                          "⌘Z Undo · ⌘⇧Z Redo · ⌘B Bold · ⌘I Italic · ⌘U Underline · ⌘K Link · ⌘S Save · ⌘P Print",
                        );
                        setMenu(null);
                      }}
                    />
                    <MenuItem
                      label="About Flow Document"
                      onClick={() => {
                        window.alert(
                          "Flow Document is a continuous Google Docs–style editor for SendDox. Existing Creator documents are unchanged.",
                        );
                        setMenu(null);
                      }}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mr-1 flex shrink-0 items-start gap-2 self-start pt-1">
          <Link
            href={closeHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-[#202124] hover:bg-[#f1f3f4]"
          >
            <span aria-hidden>←</span>
            Back
          </Link>
          {actionsItems && actionsItems.length > 0 ? (
            <FlowActionsMenu items={actionsItems} disabled={locked} />
          ) : null}
        </div>
      </div>

      {/* Main toolbar */}
      <div className="px-3 pb-2 pt-1">
        <div className="relative flex flex-wrap items-center gap-0.5 rounded-full bg-[#f0f4f9] px-2 py-1">
          <ToolbarIconButton
            title="Menus"
            active={popover === "menus"}
            onClick={() => togglePopover("menus")}
            className="rounded-full px-2.5"
          >
            <IconSearch />
            <span className="ml-1 text-xs">Menus</span>
          </ToolbarIconButton>
          <Sep />
          <ToolbarIconButton title="Undo" disabled={!format?.canUndo || locked} onClick={() => run(() => undo(editor!))}>
            <IconUndo />
          </ToolbarIconButton>
          <ToolbarIconButton title="Redo" disabled={!format?.canRedo || locked} onClick={() => run(() => redo(editor!))}>
            <IconRedo />
          </ToolbarIconButton>
          <ToolbarIconButton title="Print" disabled={locked} onClick={() => run(onPrint)}>
            <IconPrint />
          </ToolbarIconButton>
          <ToolbarIconButton title="Spelling" disabled={locked} onClick={() => undefined}>
            <IconSpellcheck />
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Paint format"
            active={paintMode}
            disabled={locked}
            onClick={capturePaintFormat}
          >
            <IconPaint />
          </ToolbarIconButton>
          <DropdownTrigger
            label={`${zoom}%`}
            title="Zoom"
            open={popover === "zoom"}
            disabled={locked}
            onClick={() => togglePopover("zoom")}
          />
          <Sep />
          <DropdownTrigger
            label={styleLabel}
            title="Styles"
            open={popover === "style"}
            disabled={locked}
            wide
            onClick={() => togglePopover("style")}
          />
          <Sep />
          <DropdownTrigger
            label={currentFontLabel}
            title="Font"
            open={popover === "font"}
            disabled={locked}
            wide
            onClick={() => togglePopover("font")}
          />
          <Sep />
          <div className="flex items-center">
            <ToolbarIconButton title="Decrease font size" disabled={locked} onClick={() => bumpFontSize(-1)}>
              <span className="text-sm font-medium">−</span>
            </ToolbarIconButton>
            <button
              type="button"
              disabled={locked}
              className="mx-0.5 h-7 min-w-[2.25rem] rounded border border-transparent bg-white px-1 text-center text-xs hover:border-[#dadce0] disabled:opacity-40"
              onClick={() => togglePopover("size")}
            >
              {currentSizePt}
            </button>
            <ToolbarIconButton title="Increase font size" disabled={locked} onClick={() => bumpFontSize(1)}>
              <span className="text-sm font-medium">+</span>
            </ToolbarIconButton>
          </div>
          <Sep />
          <ToolbarIconButton
            title="Bold"
            active={format?.bold}
            disabled={locked}
            onClick={() => run(() => toggleBold(editor!))}
          >
            <span className="text-sm font-bold">B</span>
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Italic"
            active={format?.italic}
            disabled={locked}
            onClick={() => run(() => toggleItalic(editor!))}
          >
            <span className="text-sm italic">I</span>
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Underline"
            active={format?.underline}
            disabled={locked}
            onClick={() => run(() => toggleUnderline(editor!))}
          >
            <span className="text-sm underline">U</span>
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Text color"
            active={popover === "color"}
            disabled={locked}
            onClick={() => togglePopover("color")}
          >
            <IconTextColor color={format?.color || "#000000"} />
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Highlight color"
            active={popover === "highlight"}
            disabled={locked}
            onClick={() => togglePopover("highlight")}
          >
            <IconHighlight color={format?.highlight || "#fef08a"} />
          </ToolbarIconButton>
          <Sep />
          <ToolbarIconButton
            title="Insert link"
            active={Boolean(format?.link) || popover === "link"}
            disabled={locked}
            onClick={() => {
              setLinkValue(format?.link ?? "");
              togglePopover("link");
            }}
          >
            <IconLink />
          </ToolbarIconButton>
          <ToolbarIconButton title="Add comment" disabled={locked} onClick={() => run(onAddComment)}>
            <IconComment />
          </ToolbarIconButton>
          <ToolbarIconButton title="Insert image" disabled={locked} onClick={() => run(onInsertImage)}>
            <IconImage />
          </ToolbarIconButton>
          {format?.inTable ? (
            <>
              <Sep />
              <ToolbarIconButton
                title="Insert row below"
                disabled={locked}
                onClick={() => run(() => editor?.chain().focus().addRowAfter().run())}
              >
                <span className="px-0.5 text-[11px] font-medium">+Row</span>
              </ToolbarIconButton>
              <ToolbarIconButton
                title="Insert column right"
                disabled={locked}
                onClick={() => run(() => editor?.chain().focus().addColumnAfter().run())}
              >
                <span className="px-0.5 text-[11px] font-medium">+Col</span>
              </ToolbarIconButton>
              <ToolbarIconButton
                title="Table options"
                disabled={locked}
                onClick={() => {
                  openFlowTableOptionsEvent();
                  setPopover(null);
                }}
              >
                <span className="px-0.5 text-[11px] font-medium">Table</span>
              </ToolbarIconButton>
            </>
          ) : null}
          <Sep />
          <ToolbarIconButton
            title="Align"
            active={popover === "align"}
            disabled={locked}
            onClick={() => togglePopover("align")}
          >
            <IconAlign value={format?.align || "left"} />
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Line & paragraph spacing"
            active={popover === "line"}
            disabled={locked}
            onClick={() => togglePopover("line")}
          >
            <IconLineSpacing />
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Checklist"
            active={editor?.isActive("taskList")}
            disabled={locked}
            onClick={() => run(() => editor?.chain().focus().toggleTaskList().run())}
          >
            <IconChecklist />
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Bulleted list"
            active={format?.bulletList}
            disabled={locked}
            onClick={() => run(() => toggleBulletList(editor!))}
          >
            <IconBullets />
          </ToolbarIconButton>
          <ToolbarIconButton
            title="Numbered list"
            active={format?.orderedList}
            disabled={locked}
            onClick={() => run(() => toggleOrderedList(editor!))}
          >
            <IconNumbers />
          </ToolbarIconButton>
          <ToolbarIconButton title="Decrease indent" disabled={locked} onClick={() => run(() => outdentSelection(editor!))}>
            <IconOutdent />
          </ToolbarIconButton>
          <ToolbarIconButton title="Increase indent" disabled={locked} onClick={() => run(() => indentSelection(editor!))}>
            <IconIndent />
          </ToolbarIconButton>
          <ToolbarIconButton title="Clear formatting" disabled={locked} onClick={() => run(() => clearFormatting(editor!))}>
            <IconClearFormat />
          </ToolbarIconButton>

          {/* Popovers */}
          {popover === "menus" ? (
            <PopoverPanel className="left-2 w-72 p-2">
              <input
                autoFocus
                value={menuQuery}
                onChange={(event) => setMenuQuery(event.target.value)}
                placeholder="Search the menus"
                className="mb-2 h-8 w-full rounded-md border border-[#dadce0] px-2 text-sm outline-none focus:border-[#1a73e8]"
              />
              <div className="max-h-64 overflow-auto">
                {menuItems.map((item) => (
                  <button
                    key={`${item.menu}-${item.label}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-[#f1f3f4]"
                    onClick={() => run(item.action)}
                  >
                    <span>{item.label}</span>
                    <span className="text-[11px] text-[#5f6368]">{item.menu}</span>
                  </button>
                ))}
              </div>
            </PopoverPanel>
          ) : null}

          {popover === "zoom" ? (
            <PopoverPanel className="left-40 w-28">
              {ZOOM_OPTIONS.map((value) => (
                <MenuItem
                  key={value}
                  label={`${value}%`}
                  onClick={() => {
                    onZoomChange(value);
                    setPopover(null);
                  }}
                />
              ))}
            </PopoverPanel>
          ) : null}

          {popover === "style" ? (
            <PopoverPanel className="left-52 w-48">
              {BLOCK_STYLES.map((style) => (
                <MenuItem key={style.id} label={style.label} onClick={() => applyBlockStyle(style.id)} />
              ))}
            </PopoverPanel>
          ) : null}

          {popover === "font" ? (
            <PopoverPanel className="left-72 max-h-80 w-56 overflow-auto">
              {FLOW_GOOGLE_FONTS.map((font) => (
                <button
                  key={font.id}
                  type="button"
                  className="flex w-full items-center px-3 py-1.5 text-left text-sm hover:bg-[#f1f3f4]"
                  style={{ fontFamily: font.family }}
                  onClick={() => run(() => setFontFamily(editor!, font.family))}
                >
                  {font.label}
                </button>
              ))}
            </PopoverPanel>
          ) : null}

          {popover === "size" ? (
            <PopoverPanel className="left-[28rem] max-h-72 w-24 overflow-auto">
              {FLOW_FONT_SIZES_PT.map((size) => (
                <MenuItem
                  key={size}
                  label={size}
                  onClick={() => run(() => setFontSize(editor!, fontSizeToCss(size)))}
                />
              ))}
            </PopoverPanel>
          ) : null}

          {popover === "color" ? (
            <PopoverPanel className="left-[32rem] w-44 p-2">
              <div className="grid grid-cols-5 gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    className="h-6 w-6 rounded-full border border-[#dadce0]"
                    style={{ background: color }}
                    onClick={() => run(() => setTextColor(editor!, color))}
                  />
                ))}
              </div>
            </PopoverPanel>
          ) : null}

          {popover === "highlight" ? (
            <PopoverPanel className="left-[34rem] w-44 p-2">
              <div className="grid grid-cols-5 gap-1">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    className="h-6 w-6 rounded border border-[#dadce0]"
                    style={{ background: color }}
                    onClick={() => run(() => setHighlightColor(editor!, color))}
                  />
                ))}
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded px-2 py-1 text-left text-xs hover:bg-[#f1f3f4]"
                onClick={() => run(() => editor?.chain().focus().unsetHighlight().run())}
              >
                None
              </button>
            </PopoverPanel>
          ) : null}

          {popover === "align" ? (
            <PopoverPanel className="right-24 w-40">
              <MenuItem label="Left" onClick={() => run(() => setAlignment(editor!, "left"))} />
              <MenuItem label="Center" onClick={() => run(() => setAlignment(editor!, "center"))} />
              <MenuItem label="Right" onClick={() => run(() => setAlignment(editor!, "right"))} />
              <MenuItem label="Justify" onClick={() => run(() => setAlignment(editor!, "justify"))} />
            </PopoverPanel>
          ) : null}

          {popover === "line" ? (
            <PopoverPanel className="right-16 w-40">
              {LINE_HEIGHTS.map((item) => (
                <MenuItem
                  key={item.id || "default"}
                  label={item.label}
                  onClick={() =>
                    run(() => {
                      if (!item.id) {
                        editor?.chain().focus().unsetLineHeight().run();
                      } else {
                        setLineHeight(editor!, item.id);
                      }
                    })
                  }
                />
              ))}
            </PopoverPanel>
          ) : null}

          {popover === "link" ? (
            <PopoverPanel className="right-8 w-80 p-2">
              <input
                autoFocus
                value={linkValue}
                onChange={(event) => setLinkValue(event.target.value)}
                placeholder="https://"
                className="mb-2 h-8 w-full rounded border border-[#dadce0] px-2 text-sm outline-none focus:border-[#1a73e8]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-[#1a73e8] px-3 py-1 text-xs text-white"
                  onClick={() =>
                    run(() => {
                      if (linkValue.trim()) {
                        setLinkHref(editor!, linkValue.trim());
                      } else {
                        unsetLink(editor!);
                      }
                    })
                  }
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="rounded border border-[#dadce0] px-3 py-1 text-xs"
                  onClick={() => run(() => unsetLink(editor!))}
                >
                  Remove
                </button>
              </div>
            </PopoverPanel>
          ) : null}
        </div>
      </div>

      {onAddContact || onPreview || onDownloadPdf || onCopyUrl ? (
        <div className="px-3 pb-2">
          <div
            className="relative flex flex-wrap items-center gap-0.5 rounded-full bg-[#f0f4f9] px-2 py-1"
            role="toolbar"
            aria-label="Document sharing"
          >
            {onAddContact ? (
              <ToolbarIconButton
                title="Add Contact"
                disabled={documentActionsDisabled}
                onClick={onAddContact}
                className="rounded-full px-2.5"
              >
                <IconPersonAdd />
                <span className="ml-1 text-xs">Add Contact</span>
              </ToolbarIconButton>
            ) : null}
            {onAddContact && (onPreview || onDownloadPdf || onCopyUrl) ? <Sep /> : null}
            {onPreview ? (
              <ToolbarIconButton
                title="Preview"
                disabled={documentActionsDisabled}
                onClick={onPreview}
                className="rounded-full px-2.5"
              >
                <IconEye />
                <span className="ml-1 text-xs">Preview</span>
              </ToolbarIconButton>
            ) : null}
            {onDownloadPdf ? (
              <ToolbarIconButton
                title="Download PDF"
                disabled={documentActionsDisabled}
                onClick={onDownloadPdf}
                className="rounded-full px-2.5"
              >
                <IconDownloadPdf />
                <span className="ml-1 text-xs">Download PDF</span>
              </ToolbarIconButton>
            ) : null}
            {onCopyUrl ? (
              <ToolbarIconButton
                title={copyUrlLabel}
                disabled={documentActionsDisabled}
                onClick={onCopyUrl}
                className="rounded-full px-2.5"
              >
                <IconLink />
                <span className="ml-1 text-xs">{copyUrlLabel}</span>
              </ToolbarIconButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function showWordCount(editor: Editor | null) {
  if (!editor) {
    return;
  }
  const text = editor.state.doc.textContent;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  window.alert(`Word count\n\nWords: ${words}\nCharacters: ${chars}`);
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-[#c4c7c5]" aria-hidden />;
}

function PopoverPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "absolute top-full z-50 mt-1 rounded-md border border-[#dadce0] bg-white py-1 shadow-lg",
        className,
      )}
    >
      {children}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  shortcut,
  disabled,
}: {
  label: string;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-sm text-[#202124] hover:bg-[#f1f3f4] disabled:opacity-40"
    >
      <span>{label}</span>
      {shortcut ? <span className="text-[11px] text-[#5f6368]">{shortcut}</span> : null}
    </button>
  );
}

function DropdownTrigger({
  label,
  title,
  open,
  onClick,
  disabled,
  wide,
}: {
  label: string;
  title: string;
  open: boolean;
  onClick: () => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded px-2 text-xs text-[#202124] hover:bg-[#e8eaed] disabled:opacity-40",
        wide ? "min-w-[6.5rem] justify-between" : "",
        open && "bg-[#d3e3fd]",
      )}
    >
      <span className="max-w-[7rem] truncate">{label}</span>
      <Chevron />
    </button>
  );
}

function ToolbarIconButton({
  children,
  title,
  onClick,
  active,
  disabled,
  className,
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded text-[#202124] hover:bg-[#e8eaed] disabled:opacity-40",
        active && "bg-[#d3e3fd]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}

function DocsIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset; avoid next/image config for public PNG
    <img
      src="/brand/flow-doc-icon.png"
      alt=""
      width={72}
      height={72}
      className="h-[72px] w-[72px] object-contain"
      draggable={false}
    />
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
function IconUndo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}
function IconRedo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </svg>
  );
}
function IconPrint() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" />
    </svg>
  );
}
function IconPersonAdd() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconDownloadPdf() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6" />
      <path d="M9 15l3 3 3-3" />
    </svg>
  );
}
function IconSpellcheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 20L10 4h2l6 16" />
      <path d="M7 14h8" />
      <path d="M15 16l2 2 4-4" />
    </svg>
  );
}
function IconPaint() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 3H9l-6 6 9 9 10-10V3z" />
      <path d="M3 21h7" />
    </svg>
  );
}
function IconTextColor({ color }: { color: string }) {
  return (
    <span className="flex flex-col items-center leading-none">
      <span className="text-[13px] font-semibold">A</span>
      <span className="mt-0.5 h-1 w-3.5 rounded-sm" style={{ background: color }} />
    </span>
  );
}
function IconHighlight({ color }: { color: string }) {
  return (
    <span className="flex flex-col items-center">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M3 17l4 4 3-3-4-4-3 3zm14.7-10.3l-8.5 8.5 2.8 2.8 8.5-8.5-2.8-2.8zM14 3l7 7 1.5-1.5L15.5 1.5 14 3z" />
      </svg>
      <span className="mt-0.5 h-1 w-3.5 rounded-sm" style={{ background: color }} />
    </span>
  );
}
function IconLink() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" />
    </svg>
  );
}
function IconComment() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M12 8v6M9 11h6" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="M21 16l-5-5-4 4-2-2-5 5" />
    </svg>
  );
}
function IconAlign({ value }: { value: string }) {
  const lines =
    value === "center"
      ? ["M6 7h12", "M8 12h8", "M6 17h12"]
      : value === "right"
        ? ["M6 7h12", "M10 12h8", "M8 17h10"]
        : value === "justify"
          ? ["M4 7h16", "M4 12h16", "M4 17h16"]
          : ["M4 7h16", "M4 12h12", "M4 17h14"];
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {lines.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
function IconLineSpacing() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 8V4m0 0L2 6m2-2l2 2M4 16v4m0 0l-2-2m2 2l2-2" />
    </svg>
  );
}
function IconChecklist() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="6" height="6" rx="1" />
      <path d="M5 8l1.2 1.2L9 6.5" />
      <path d="M12 8h9M3 17h18" />
    </svg>
  );
}
function IconBullets() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="7" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="5" cy="17" r="1.5" />
      <rect x="9" y="6" width="12" height="2" rx="1" />
      <rect x="9" y="11" width="12" height="2" rx="1" />
      <rect x="9" y="16" width="12" height="2" rx="1" />
    </svg>
  );
}
function IconNumbers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <text x="2" y="9" fontSize="7">
        1
      </text>
      <text x="2" y="14" fontSize="7">
        2
      </text>
      <text x="2" y="19" fontSize="7">
        3
      </text>
      <rect x="9" y="6" width="12" height="2" rx="1" />
      <rect x="9" y="11" width="12" height="2" rx="1" />
      <rect x="9" y="16" width="12" height="2" rx="1" />
    </svg>
  );
}
function IconOutdent() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M3 12h10M3 18h18" />
      <path d="M15 9l-3 3 3 3" />
    </svg>
  );
}
function IconIndent() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M11 12h10M3 18h18" />
      <path d="M3 9l3 3-3 3" />
    </svg>
  );
}
function IconClearFormat() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 20h8" />
      <path d="M9 4l7 16" />
      <path d="M5 12h10" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
