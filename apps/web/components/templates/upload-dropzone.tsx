"use client";

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  createTemplateFromFile,
  isSupportedUpload,
  type UploadProgress,
} from "@/lib/templates/create-from-upload";

type Props = {
  onUploaded: () => void;
};

export function UploadDropzone({ onUploaded }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) {
        return;
      }

      const unsupported = files.filter((file) => !isSupportedUpload(file));
      const supported = files.filter(isSupportedUpload);

      setError(
        unsupported.length > 0
          ? `Skipped ${unsupported.map((file) => file.name).join(", ")} — only PDF, JPG, PNG, and WebP are supported.`
          : "",
      );

      if (supported.length === 0) {
        return;
      }

      setBusy(true);
      const created: Array<{ id: string }> = [];
      try {
        for (const file of supported) {
          created.push(await createTemplateFromFile(file, setProgress));
        }
        onUploaded();
        // A single upload is almost always something the user wants to start
        // placing fields on right away; a batch is better reviewed in the list.
        if (created.length === 1 && unsupported.length === 0) {
          router.push(`/app/templates/${created[0]!.id}`);
        }
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
      } finally {
        setBusy(false);
        setProgress(null);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [onUploaded, router],
  );

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) {
      void handleFiles(event.dataTransfer.files);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!busy) {
      setDragging(true);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Upload a file</h2>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        className={`rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-primary bg-primary/[0.04]" : "border-border bg-surface"
        }`}
      >
        {busy ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              {progress?.fileName ?? "Preparing upload…"}
            </p>
            <p className="text-sm text-muted">{progress?.stage ?? "Working…"}</p>
            <div className="mx-auto h-1.5 w-64 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${Math.round((progress?.ratio ?? 0.05) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              Drag and drop one or multiple files
            </p>
            <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, WebP · up to 25MB each</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
            >
              Select files
            </button>
            <p className="mt-3 text-xs text-muted">
              Multi-page PDFs become one editable page per sheet.
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_UPLOAD_EXTENSIONS}
          onChange={onChange}
          className="hidden"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
