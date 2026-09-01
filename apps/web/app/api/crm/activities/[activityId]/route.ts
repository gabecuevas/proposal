import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { updateActivity } from "@/lib/crm/activities";
import type { CrmActivityAvailability, CrmActivityPriority, CrmActivityType } from "@repo/db";

type Params = { params: Promise<{ activityId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { activityId } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const activity = await updateActivity(activityId, auth.workspaceId, auth.userId, {
    assigneeUserId: typeof body.assigneeUserId === "string" ? body.assigneeUserId : undefined,
    activityType:
      typeof body.activityType === "string" ? (body.activityType as CrmActivityType) : undefined,
    subject: typeof body.subject === "string" ? body.subject : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    location: typeof body.location === "string" ? body.location : undefined,
    videoCallUrl: typeof body.videoCallUrl === "string" ? body.videoCallUrl : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    priority:
      body.priority === null
        ? null
        : typeof body.priority === "string"
          ? (body.priority as CrmActivityPriority)
          : undefined,
    availability:
      body.availability === "FREE" || body.availability === "BUSY"
        ? (body.availability as CrmActivityAvailability)
        : undefined,
    dueAt: typeof body.dueAt === "string" ? body.dueAt : body.dueAt === null ? null : undefined,
    endAt: typeof body.endAt === "string" ? body.endAt : body.endAt === null ? null : undefined,
    markDone: typeof body.markDone === "boolean" ? body.markDone : undefined,
  });

  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }
  return NextResponse.json({ activity });
}
