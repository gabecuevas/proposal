import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { requireSessionFromRequest } from "@/lib/auth/session";
import {
  isSupportAdminEnabled,
  isSupportMessengerEnabled,
} from "@/lib/support/flags";
import { recordMeaningfulActivity } from "@/lib/support/activity";

export async function POST(request: NextRequest) {
  if (!isSupportMessengerEnabled() && !isSupportAdminEnabled()) {
    return jsonWithRequestId(request, { ok: true, skipped: true });
  }

  const session = await requireSessionFromRequest(request);
  if (!session) {
    return jsonWithRequestId(request, { ok: false }, { status: 401 });
  }

  let workspaceId: string | null = null;
  try {
    const body = (await request.json()) as { workspaceId?: string };
    workspaceId = body.workspaceId?.trim() || session.workspaceId || null;
  } catch {
    workspaceId = session.workspaceId || null;
  }

  await recordMeaningfulActivity({
    userId: session.userId,
    workspaceId,
  });

  return jsonWithRequestId(request, { ok: true });
}
