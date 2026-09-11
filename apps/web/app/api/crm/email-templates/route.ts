import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { createEmailTemplate, listEmailTemplates } from "@/lib/crm/email-templates";

export async function GET(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const q = request.nextUrl.searchParams.get("q") ?? undefined;
    const templates = await listEmailTemplates(auth.workspaceId, q);
    return jsonWithRequestId(request, { templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load email templates";
    return jsonWithRequestId(request, { error: message, templates: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getRequestAuthContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return jsonWithRequestId(request, { error: "Invalid JSON body." }, { status: 400 });
    }
    const visibility =
      body.visibility === "SHARED" || body.visibility === "PRIVATE" ? body.visibility : "PRIVATE";
    const template = await createEmailTemplate(auth.workspaceId, {
      name: typeof body.name === "string" ? body.name : "",
      subject: typeof body.subject === "string" ? body.subject : "",
      bodyHtml: typeof body.bodyHtml === "string" ? body.bodyHtml : "<p></p>",
      visibility,
      userId: auth.userId,
    });
    return jsonWithRequestId(request, { template });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create template";
    const status = message.includes("required") ? 400 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
