import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  createActivity,
  listActivitiesForDay,
  listActivitiesForRecord,
  type CreateActivityInput,
} from "@/lib/crm/activities";
import type { CrmActivityAvailability, CrmActivityPriority, CrmActivityType } from "@repo/db";

function parseActivityType(value: unknown): CrmActivityType | null {
  const types: CrmActivityType[] = ["CALL", "MEETING", "TASK", "DEADLINE", "EMAIL", "LUNCH"];
  return typeof value === "string" && types.includes(value as CrmActivityType)
    ? (value as CrmActivityType)
    : null;
}

function parsePriority(value: unknown): CrmActivityPriority | null | undefined {
  if (value === null || value === "") {
    return null;
  }
  const priorities: CrmActivityPriority[] = ["LOW", "MEDIUM", "HIGH"];
  return typeof value === "string" && priorities.includes(value as CrmActivityPriority)
    ? (value as CrmActivityPriority)
    : undefined;
}

function parseAvailability(value: unknown): CrmActivityAvailability | undefined {
  if (value === "FREE" || value === "BUSY") {
    return value;
  }
  return undefined;
}

function dayBounds(dateKey: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const start = new Date(year, month, day, 0, 0, 0, 0);
  const end = new Date(year, month, day + 1, 0, 0, 0, 0);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const url = new URL(request.url);
  const contactId = url.searchParams.get("contactId") ?? undefined;
  const leadId = url.searchParams.get("leadId") ?? undefined;
  const companyId = url.searchParams.get("companyId") ?? undefined;
  const date = url.searchParams.get("date") ?? undefined;
  const assigneeUserId = url.searchParams.get("assigneeUserId") ?? undefined;

  if (date) {
    const bounds = dayBounds(date);
    if (!bounds) {
      return errorResponse(request, { status: 400, code: "invalid_date", message: "Invalid date" });
    }
    const activities = await listActivitiesForDay(auth.workspaceId, bounds.start, bounds.end, assigneeUserId);
    return jsonWithRequestId(request, { activities });
  }

  if (!contactId && !leadId && !companyId) {
    return jsonWithRequestId(request, { activities: [] });
  }

  const activities = await listActivitiesForRecord(auth.workspaceId, { contactId, leadId, companyId });
  return jsonWithRequestId(request, { activities });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const body = (await request.json()) as Record<string, unknown>;
  const activityType = parseActivityType(body.activityType);
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!activityType || !subject) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Activity type and subject are required",
    });
  }

  const input: CreateActivityInput = {
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    assigneeUserId: typeof body.assigneeUserId === "string" ? body.assigneeUserId : auth.userId,
    contactId: typeof body.contactId === "string" ? body.contactId : null,
    leadId: typeof body.leadId === "string" ? body.leadId : null,
    companyId: typeof body.companyId === "string" ? body.companyId : null,
    activityType,
    subject,
    description: typeof body.description === "string" ? body.description : null,
    location: typeof body.location === "string" ? body.location : null,
    videoCallUrl: typeof body.videoCallUrl === "string" ? body.videoCallUrl : null,
    notes: typeof body.notes === "string" ? body.notes : null,
    priority: parsePriority(body.priority),
    availability: parseAvailability(body.availability),
    dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
    endAt: typeof body.endAt === "string" ? body.endAt : null,
    markDone: body.markDone === true,
  };

  const activity = await createActivity(input);
  return jsonWithRequestId(request, { activity }, { status: 201 });
}
