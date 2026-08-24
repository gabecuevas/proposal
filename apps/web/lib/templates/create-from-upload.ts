"use client";

import { buildPageBackedEditorDoc, templateNameFromFileName, type TemplatePageImage } from "@/lib/editor/pdf-template";
import { rasterizePdf, readImageDimensions } from "@/lib/pdf/rasterize";

export const ACCEPTED_UPLOAD_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
export const ACCEPTED_UPLOAD_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp";

export type UploadProgress = {
  fileName: string;
  /** Human readable description of the current step. */
  stage: string;
  /** 0–1 across the whole file, or null while the page count is unknown. */
  ratio: number | null;
};

export function isSupportedUpload(file: File): boolean {
  return ACCEPTED_UPLOAD_TYPES.includes(file.type);
}

async function uploadBlob(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append("file", new File([blob], fileName, { type: blob.type }));

  const response = await fetch("/api/uploads", { method: "POST", body: form });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Upload failed");
  }

  const payload = (await response.json()) as { upload: { key: string } };
  return payload.upload.key;
}

async function pagesFromFile(
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<TemplatePageImage[]> {
  if (file.type === "application/pdf") {
    onProgress({ fileName: file.name, stage: "Reading PDF…", ratio: null });

    const rendered = await rasterizePdf(file, (done, total) => {
      onProgress({
        fileName: file.name,
        stage: `Rendering page ${done} of ${total}…`,
        // Rendering is the first half of the work, uploading is the second.
        ratio: (done / total) * 0.5,
      });
    });

    const pages: TemplatePageImage[] = [];
    for (const page of rendered) {
      onProgress({
        fileName: file.name,
        stage: `Uploading page ${page.pageNumber} of ${rendered.length}…`,
        ratio: 0.5 + (page.pageNumber / rendered.length) * 0.5,
      });
      const key = await uploadBlob(page.blob, `page-${page.pageNumber}.jpg`);
      pages.push({ key, pageNumber: page.pageNumber, width: page.width, height: page.height });
    }
    return pages;
  }

  onProgress({ fileName: file.name, stage: "Uploading image…", ratio: 0.5 });
  const { width, height } = await readImageDimensions(file);
  const key = await uploadBlob(file, file.name);
  return [{ key, pageNumber: 1, width, height }];
}

export async function createTemplateFromFile(
  file: File,
  onProgress: (progress: UploadProgress) => void,
): Promise<{ id: string; name: string }> {
  const pages = await pagesFromFile(file, onProgress);

  onProgress({ fileName: file.name, stage: "Creating template…", ratio: 1 });

  const response = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: templateNameFromFileName(file.name),
      editor_json: buildPageBackedEditorDoc(pages),
      tags: ["uploaded"],
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? "Failed to create template");
  }

  const payload = (await response.json()) as { template: { id: string; name: string } };
  return payload.template;
}
