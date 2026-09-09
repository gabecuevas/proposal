import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { listCrmEmails, parseEmailFolder } from "@/lib/crm/emails";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const folder = parseEmailFolder(request.nextUrl.searchParams.get("folder"));
  const messages = await listCrmEmails(auth.workspaceId, folder);
  return jsonWithRequestId(request, { folder, messages });
}
