import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { renderBodyHtmlToPdf } from "@/lib/editor/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

type RenderBody = {
  bodyHtml?: unknown;
  pageSize?: unknown;
  title?: unknown;
  filename?: unknown;
};

function safeFilename(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const base = (raw || "document").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 120);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    assertRole(auth, "MEMBER");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RenderBody;
  try {
    body = (await request.json()) as RenderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.bodyHtml !== "string" || !body.bodyHtml.trim()) {
    return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });
  }
  if (body.bodyHtml.length > 4_000_000) {
    return NextResponse.json({ error: "Document is too large to render" }, { status: 413 });
  }

  const filename = safeFilename(body.filename ?? body.title);
  const disposition = request.nextUrl.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

  try {
    const pdf = await renderBodyHtmlToPdf({
      bodyHtml: body.bodyHtml,
      pageSize: body.pageSize,
      title: typeof body.title === "string" ? body.title : filename.replace(/\.pdf$/i, ""),
    });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
        "Content-Disposition": `${disposition}; filename="${filename.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF render failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
