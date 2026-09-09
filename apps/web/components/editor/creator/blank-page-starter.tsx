"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import {
  insertAdjustableTextBox,
  insertImageAsset,
  insertQuoteTable,
  insertTable,
  insertTextBlock,
  insertVariable,
  insertVideo,
  isSupportedImage,
  uploadAsset,
} from "@/lib/editor/insert-elements";
import { isScaffoldFlowNode } from "@/lib/editor/extensions/flow-gaps";
import { useCreatorChrome } from "./creator-chrome-context";
import { IconLibrary, IconPlus } from "./creator-icons";

type Props = {
  editor: Editor | null;
  variableKeys?: string[];
};

function isBlankFlowDoc(editor: Editor): boolean {
  let realBlocks = 0;
  editor.state.doc.forEach((node) => {
    if (node.type.name === "fieldOverlay" || node.type.name === "fieldCanvas" || node.type.name === "pageBreak") {
      return;
    }
    if (isScaffoldFlowNode(node)) {
      return;
    }
    realBlocks += 1;
  });
  return realBlocks === 0;
}

/**
 * Empty-page starter — full-width Text Block chips like PandaDoc’s blank page.
 */
export function BlankPageStarter({ editor, variableKeys = [] }: Props) {
  const chrome = useCreatorChrome();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const bump = () => setTick((n) => n + 1);
    editor.on("update", bump);
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("update", bump);
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);

  if (!editor || !isBlankFlowDoc(editor)) {
    return null;
  }

  const firstVariable = variableKeys[0];

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[15] px-[var(--creator-page-margin,48px)] pt-[var(--creator-page-margin,48px)]"
      onMouseDown={(event) => {
        // Clicking the hint focuses the blank scaffold so typing starts immediately.
        if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === "P") {
          event.preventDefault();
          editor.chain().focus("start").run();
        }
      }}
    >
      <p
        className="pointer-events-auto mb-3 cursor-text text-sm text-slate-400"
        onMouseDown={(event) => {
          event.preventDefault();
          insertTextBlock(editor);
          editor.commands.focus("start");
        }}
      >
        Click here to start typing
      </p>
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        <Chip
          label="Text"
          onClick={() => {
            insertTextBlock(editor);
            editor.commands.focus("start");
          }}
        />
        <Chip
          label="Image"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/png,image/jpeg,image/webp";
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file || !isSupportedImage(file)) {
                return;
              }
              void uploadAsset(file).then((asset) => insertImageAsset(editor, asset));
            };
            input.click();
          }}
        />
        <Chip
          label="Video"
          onClick={() => {
            const url = window.prompt("Paste a YouTube link");
            if (url) {
              insertVideo(editor, url);
            }
          }}
        />
        <Chip label="Table" onClick={() => insertTable(editor, 3, 3)} />
        <Chip label="Quote builder" onClick={() => insertQuoteTable(editor, "default")} />
        {firstVariable ? (
          <Chip
            label="Variable or In-text field"
            onClick={() => {
              insertTextBlock(editor);
              insertVariable(editor, firstVariable);
            }}
          />
        ) : (
          <Chip label="Adjustable Text Box" onClick={() => insertAdjustableTextBox(editor)} />
        )}
        <button
          type="button"
          aria-label="Open content library"
          title="Content library"
          onClick={() => chrome.openLibrary()}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:border-primary hover:text-primary"
        >
          <IconLibrary className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Add Text Block"
          title="Add Text Block"
          onClick={() => insertTextBlock(editor)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:border-primary hover:text-primary"
        >
          <IconPlus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-full border border-slate-300 bg-white px-3 text-sm text-slate-600 shadow-sm hover:border-primary hover:text-primary"
    >
      {label}
    </button>
  );
}
