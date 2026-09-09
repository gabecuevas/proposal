import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { putObject } from "@/lib/storage/object-store";
import { assetUrl, workspaceUploadPrefix } from "@/lib/storage/asset-url";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+/, "");
  return cleaned.slice(0, 120) || "file";
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(request, {
      status: 400,
      code: "invalid_form_data",
      message: "Expected multipart form data",
    });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse(request, {
      status: 400,
      code: "missing_file",
      message: "Expected a 'file' field",
    });
  }

  if (file.size === 0) {
    return errorResponse(request, {
      status: 400,
      code: "empty_file",
      message: "File is empty",
    });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(request, {
      status: 413,
      code: "file_too_large",
      message: `File exceeds the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`,
    });
  }

  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return errorResponse(request, {
      status: 415,
      code: "unsupported_file_type",
      message: "Supported uploads are PDF, PNG, JPEG, and WebP",
    });
  }

  const key = `${workspaceUploadPrefix(auth.workspaceId)}${randomUUID()}/${safeFileName(file.name)}`;

  try {
    await putObject(key, new Uint8Array(await file.arrayBuffer()), contentType);
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "upload_failed",
      message: "Failed to store the uploaded file",
    });
  }

  return jsonWithRequestId(
    request,
    {
      upload: {
        key,
        url: assetUrl(key),
        contentType,
        size: file.size,
        name: file.name,
      },
    },
    { status: 201 },
  );
}
