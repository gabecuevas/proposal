import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { convertDocxBufferToEditorDoc } from "@/lib/templates/docx-to-editor";
import { convertDocxBufferToPdf } from "@/lib/templates/docx-to-pdf";
import { asciiFilename } from "@/lib/templates/ascii-filename";
import { Buffer } from "node:buffer";

export const runtime = "nodejs";
export const maxDuration = 60;

function isDocxContentType(type: string): boolean {
  return type.includes("wordprocessingml") || type === "application/octet-stream";
}

function safeFilename(name: string): string {
  return asciiFilename(name, "document");
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    assertRole(auth, "MEMBER");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected a 'file' field" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File exceeds the 25MB limit" },
      { status: 413 },
    );
  }

  const contentType = file.type || "application/octet-stream";
  if (!isDocxContentType(contentType) && !file.name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json(
      { error: "Only .docx files are supported for Word import" },
      { status: 415 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const baseName = safeFilename(file.name.replace(/\.docx$/i, ""));
    const mode = (new URL(request.url).searchParams.get("mode") ?? "both").toLowerCase() as
      | "pdf"
      | "editor"
      | "both";

    const modes = ["pdf", "editor", "both"].includes(mode) ? mode : "both";

    const result: {
      baseName: string;
      editor_json?: unknown;
      pdfBase64?: string;
    } = { baseName };

    if (modes === "pdf" || modes === "both") {
      const pdf = await convertDocxBufferToPdf(buffer, baseName);
      result.pdfBase64 = Buffer.from(pdf).toString("base64");
    }
    if (modes === "editor" || modes === "both") {
      result.editor_json = await convertDocxBufferToEditorDoc(buffer);
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "DOCX conversion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
