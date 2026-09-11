import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { createEmailSignature, listEmailSignatures } from "@/lib/crm/email-signatures";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const accountId = request.nextUrl.searchParams.get("accountId");
    const signatures = await listEmailSignatures(auth.workspaceId, {
      accountId,
      userId: auth.userId,
    });
    return jsonWithRequestId(request, { signatures });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load signatures";
    return jsonWithRequestId(request, { error: message, signatures: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }

    const signature = await createEmailSignature(auth.workspaceId, {
      userId: auth.userId,
      accountId: typeof body.accountId === "string" ? body.accountId : null,
      name: typeof body.name === "string" ? body.name : "",
      bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : "<p></p>",
    });
    return jsonWithRequestId(request, { ok: true, signature });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create signature";
    const status = message.includes("required") || message.includes("not found") ? 400 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
