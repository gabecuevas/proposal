"use client";

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

/**
 * Sits on top of the paper without taking part in the text flow, so signer
 * fields can be dropped over any element. Pointer events are re-enabled per
 * field so clicks land on the text underneath everywhere else.
 */
export function FieldOverlayView() {
  return (
    <NodeViewWrapper className="field-overlay" data-field-overlay="true">
      <NodeViewContent className="field-overlay-content" />
    </NodeViewWrapper>
  );
}
