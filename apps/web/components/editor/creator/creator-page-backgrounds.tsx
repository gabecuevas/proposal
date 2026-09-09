"use client";

import type { Editor } from "@tiptap/core";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import { assetUrl } from "@/lib/storage/asset-url";
import {
  backgroundForPage,
  hasPageBackground,
  pageBackgroundLayerStyles,
  parsePageBackgrounds,
} from "@/lib/editor/page-backgrounds";
import { PAGE_GAP_PX, visualTopForPage, type PageSizeSpec } from "@/lib/editor/page-geometry";

type Props = {
  editor: Editor | null;
  pageCount: number;
  spec: PageSizeSpec;
};

export function CreatorPageBackgrounds({ editor, pageCount, spec }: Props) {
  const tick = useEditorEventTick(editor);
  void tick;
  const all = parsePageBackgrounds(editor?.state.doc.attrs.pageBackgrounds);
  const pages = Math.max(1, pageCount);

  return (
    <>
      {Array.from({ length: pages }, (_, index) => {
        const background = backgroundForPage(all, index);
        if (!hasPageBackground(background)) {
          return null;
        }
        const imageUrl = background.imageKey ? assetUrl(background.imageKey) : null;
        const styles = pageBackgroundLayerStyles(background, imageUrl);
        return (
          <div
            key={index}
            className="creator-page-background"
            style={{
              top: visualTopForPage(index, spec.heightPx, PAGE_GAP_PX),
              width: spec.widthPx,
              height: spec.heightPx,
            }}
            aria-hidden
          >
            {styles.color ? <div className="creator-page-background-color" style={styles.color} /> : null}
            {styles.image ? <div className="creator-page-background-image" style={styles.image} /> : null}
          </div>
        );
      })}
    </>
  );
}
