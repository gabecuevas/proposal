import type { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { isCommercialDocument } from "@/lib/commercial/schema";
import { getCommercialDocument } from "@/lib/commercial/store";
import { renderCommercialDocumentHtml } from "@/lib/commercial/render-html";
import { verifyPublicDocumentToken } from "@/lib/documents/public-link";
import { markDocumentViewed, renderDocumentHtml } from "@/lib/editor/document-store";
import { wrapPrintHtmlForDoc } from "@/lib/editor/print-document";
import type { EditorDoc } from "@/lib/editor/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

const UNAVAILABLE_STATUSES = new Set(["TRASHED", "VOID"]);

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function unavailable() {
  return htmlResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Document unavailable</title></head><body style="font-family:system-ui,sans-serif;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><p>This document is no longer available.</p></body></html>`,
    404,
  );
}

/** View-only public page for a delivered document; recipients cannot edit it. */
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const documentId = verifyPublicDocumentToken(token);
  if (!documentId) {
    return unavailable();
  }
  const row = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, workspace_id: true, status: true, pricing_json: true, editor_json: true },
  });
  if (!row || UNAVAILABLE_STATUSES.has(row.status)) {
    return unavailable();
  }

  let html: string;
  if (isCommercialDocument(row.pricing_json)) {
    const commercial = await getCommercialDocument(row.id, row.workspace_id);
    if (!commercial) {
      return unavailable();
    }
    html = renderCommercialDocumentHtml({
      commercial: commercial.commercial,
      context: commercial.variables_json as Record<string, unknown>,
      finalized: true,
      amountPaidMinorOverride: commercial.paidFromLedgerMinor || undefined,
    });
  } else {
    const output = await renderDocumentHtml({
      documentId: row.id,
      workspaceId: row.workspace_id,
      mode: "sender-preview",
    });
    html = wrapPrintHtmlForDoc(output.html, row.editor_json as EditorDoc);
  }

  if (row.status === "SENT") {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = sessionToken ? await verifySessionToken(sessionToken).catch(() => null) : null;
    if (session?.workspaceId !== row.workspace_id) {
      await markDocumentViewed({
        documentId: row.id,
        workspaceId: row.workspace_id,
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      }).catch(() => null);
    }
  }

  return htmlResponse(html);
}
