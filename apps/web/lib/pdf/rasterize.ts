"use client";

// The default pdf.js build calls `Map.prototype.getOrInsertComputed`, which no
// shipping browser implements yet. The legacy build bundles the polyfill.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

let workerConfigured = false;

function configureWorker() {
  if (workerConfigured) {
    return;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  workerConfigured = true;
}

export type RasterizedPage = {
  pageNumber: number;
  /** Intrinsic page size in PDF points, used to preserve each page's aspect ratio. */
  width: number;
  height: number;
  blob: Blob;
};

/**
 * Wide enough to stay sharp on a retina display and in print, without producing
 * images so large that a long document blows past the upload limit.
 */
const TARGET_WIDTH_PX = 1400;
const MAX_SCALE = 3;

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode page image"))),
      "image/jpeg",
      0.9,
    );
  });
}

export async function rasterizePdf(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<RasterizedPage[]> {
  configureWorker();

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  try {
    const pages: RasterizedPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(MAX_SCALE, TARGET_WIDTH_PX / baseViewport.width);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas 2D context unavailable");
      }

      // JPEG has no alpha channel, so unpainted regions would otherwise encode as black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      page.cleanup();

      pages.push({
        pageNumber,
        width: baseViewport.width,
        height: baseViewport.height,
        blob: await canvasToBlob(canvas),
      });

      onProgress?.(pageNumber, pdf.numPages);
    }

    return pages;
  } finally {
    await loadingTask.destroy();
  }
}

export async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new window.Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Failed to read image"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
