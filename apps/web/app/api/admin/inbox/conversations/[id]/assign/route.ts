import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { assignConversation } from "@/lib/support/conversations";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const { id } = await params;
  const body = (await request.json()) as { assigneeAdminId?: string | null };
  const assignee =
    body.assigneeAdminId === undefined ? admin.userId : body.assigneeAdminId;
  const conversation = await assignConversation(id, assignee);
  return jsonWithRequestId(request, { conversation });
}
