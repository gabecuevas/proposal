"use client";

import type { Editor } from "@tiptap/core";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { copySignerFieldNode } from "@/lib/editor/field-clipboard";
import { FIELD_OPTIONS_MENU_HEIGHT, FIELD_OPTIONS_MENU_WIDTH, placeFieldMenu } from "@/lib/editor/place-field-menu";
import { parseSignerFieldAttrs } from "@/lib/editor/signer-field-attrs";
import { FieldSettingsPanel } from "../field-settings-panel";
import { useSignerRecipients } from "../signer-field-context";

type Props = {
  editor: Editor;
  getPos: () => number | undefined;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
};

export function FieldOptionsMenu({ editor, getPos, onClose, anchorRef }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const recipients = useSignerRecipients();
  const [coords, setCoords] = useState<ReturnType<typeof placeFieldMenu> | null>(null);

  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) {
        return;
      }
      setCoords(
        placeFieldMenu(
          {
            top: anchor.top,
            left: anchor.left,
            right: anchor.right,
            bottom: anchor.bottom,
            width: anchor.width,
            height: anchor.height,
          },
          { width: window.innerWidth, height: window.innerHeight },
          FIELD_OPTIONS_MENU_WIDTH,
          FIELD_OPTIONS_MENU_HEIGHT,
          "end",
        ),
      );
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  const pos = getPos();
  const node = typeof pos === "number" ? editor.state.doc.nodeAt(pos) : null;
  if (typeof pos !== "number" || !node || node.type.name !== "signerField") {
    return null;
  }
  const fieldPos = pos;
  const fieldNode = node;
  const attrs = parseSignerFieldAttrs(fieldNode.attrs as Record<string, unknown>, 0);

  function update(partial: Record<string, unknown>) {
    editor.chain().setNodeSelection(fieldPos).updateAttributes("signerField", partial).run();
  }

  function duplicate() {
    const json = fieldNode.toJSON() as { type: string; attrs?: Record<string, unknown> };
    const xPct = Number(json.attrs?.xPct ?? attrs.xPct) + 0.02;
    const yPct = Number(json.attrs?.yPct ?? attrs.yPct) + 0.02;
    editor
      .chain()
      .insertContentAt(fieldPos + fieldNode.nodeSize, {
        ...json,
        attrs: {
          ...(json.attrs ?? {}),
          fieldId: `field-${globalThis.crypto.randomUUID()}`,
          xPct: Math.min(0.92, xPct),
          yPct: Math.min(0.92, yPct),
        },
      })
      .run();
    onClose();
  }

  function copy() {
    copySignerFieldNode({ type: "signerField", attrs: { ...fieldNode.attrs, fieldId: attrs.fieldId } });
    onClose();
  }

  function remove() {
    editor.chain().deleteRange({ from: fieldPos, to: fieldPos + fieldNode.nodeSize }).run();
    onClose();
  }

  function cut() {
    copySignerFieldNode({ type: "signerField", attrs: { ...fieldNode.attrs } });
    remove();
  }

  if (typeof document === "undefined" || !coords) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="dialog"
      aria-label="Field settings"
      data-field-settings
      className="z-[80]"
      style={{
        position: "fixed",
        top: coords.top,
        bottom: coords.bottom,
        left: coords.left,
        maxHeight: coords.maxHeight,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <FieldSettingsPanel
        attrs={attrs}
        recipients={recipients}
        maxHeight={coords.maxHeight}
        onChange={update}
        onCopy={copy}
        onCut={cut}
        onDuplicate={duplicate}
        onDelete={remove}
      />
    </div>,
    document.body,
  );
}
