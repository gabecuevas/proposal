import { prisma, type CrmActivityAvailability, type CrmActivityPriority, type CrmActivityType } from "@repo/db";
import { userDisplayName } from "./display-name";
import { writeTimelineEvent } from "./timeline";

export type CrmActivityRecord = {
  id: string;
  workspace_id: string;
  created_by_user_id: string;
  assignee_user_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  company_id: string | null;
  activity_type: CrmActivityType;
  subject: string;
  description: string | null;
  location: string | null;
  video_call_url: string | null;
  notes: string | null;
  priority: CrmActivityPriority | null;
  availability: CrmActivityAvailability;
  due_at: string | null;
  end_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee_name: string | null;
  created_by_name: string | null;
};

export const CRM_ACTIVITY_TYPES: CrmActivityType[] = [
  "CALL",
  "MEETING",
  "TASK",
  "DEADLINE",
  "EMAIL",
  "LUNCH",
];

export const CRM_ACTIVITY_PRIORITIES: CrmActivityPriority[] = ["LOW", "MEDIUM", "HIGH"];

function parseActivity(row: {
  id: string;
  workspace_id: string;
  created_by_user_id: string;
  assignee_user_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  company_id: string | null;
  activity_type: CrmActivityType;
  subject: string;
  description: string | null;
  location: string | null;
  video_call_url: string | null;
  notes: string | null;
  priority: CrmActivityPriority | null;
  availability: CrmActivityAvailability;
  due_at: Date | null;
  end_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by?: { name: string; email: string } | null;
  assignee?: { name: string; email: string } | null;
}): CrmActivityRecord {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    created_by_user_id: row.created_by_user_id,
    assignee_user_id: row.assignee_user_id,
    contact_id: row.contact_id,
    lead_id: row.lead_id,
    company_id: row.company_id,
    activity_type: row.activity_type,
    subject: row.subject,
    description: row.description,
    location: row.location,
    video_call_url: row.video_call_url,
    notes: row.notes,
    priority: row.priority,
    availability: row.availability,
    due_at: row.due_at?.toISOString() ?? null,
    end_at: row.end_at?.toISOString() ?? null,
    completed_at: row.completed_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    created_by_name: userDisplayName(row.created_by),
    assignee_name: userDisplayName(row.assignee),
  };
}

const activityInclude = {
  created_by: { select: { name: true, email: true } },
  assignee: { select: { name: true, email: true } },
} as const;

export type CreateActivityInput = {
  workspaceId: string;
  actorUserId: string;
  assigneeUserId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  companyId?: string | null;
  activityType: CrmActivityType;
  subject: string;
  description?: string | null;
  location?: string | null;
  videoCallUrl?: string | null;
  notes?: string | null;
  priority?: CrmActivityPriority | null;
  availability?: CrmActivityAvailability;
  dueAt?: string | null;
  endAt?: string | null;
  markDone?: boolean;
};

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createActivity(input: CreateActivityInput): Promise<CrmActivityRecord> {
  const row = await prisma.crmActivity.create({
    data: {
      workspace_id: input.workspaceId,
      created_by_user_id: input.actorUserId,
      assignee_user_id: input.assigneeUserId ?? input.actorUserId,
      contact_id: input.contactId || null,
      lead_id: input.leadId || null,
      company_id: input.companyId || null,
      activity_type: input.activityType,
      subject: input.subject.trim(),
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      video_call_url: input.videoCallUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      priority: input.priority ?? null,
      availability: input.availability ?? "FREE",
      due_at: parseDate(input.dueAt),
      end_at: parseDate(input.endAt),
      completed_at: input.markDone ? new Date() : null,
    },
    include: activityInclude,
  });

  await writeTimelineEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    contactId: input.contactId,
    leadId: input.leadId,
    companyId: input.companyId,
    activityId: row.id,
    eventType: input.markDone ? "ACTIVITY_COMPLETED" : "ACTIVITY_CREATED",
    summary: input.markDone ? `${input.subject.trim()} completed` : `${input.subject.trim()} scheduled`,
  });

  return parseActivity(row);
}

export async function updateActivity(
  activityId: string,
  workspaceId: string,
  actorUserId: string,
  input: Partial<CreateActivityInput>,
): Promise<CrmActivityRecord | null> {
  const existing = await prisma.crmActivity.findFirst({
    where: { id: activityId, workspace_id: workspaceId },
  });
  if (!existing) {
    return null;
  }

  const markDone = input.markDone ?? Boolean(existing.completed_at);
  const row = await prisma.crmActivity.update({
    where: { id: activityId },
    data: {
      assignee_user_id:
        input.assigneeUserId !== undefined ? input.assigneeUserId || null : existing.assignee_user_id,
      contact_id: input.contactId !== undefined ? input.contactId || null : existing.contact_id,
      lead_id: input.leadId !== undefined ? input.leadId || null : existing.lead_id,
      company_id: input.companyId !== undefined ? input.companyId || null : existing.company_id,
      activity_type: input.activityType ?? existing.activity_type,
      subject: input.subject?.trim() ?? existing.subject,
      description: input.description !== undefined ? input.description?.trim() || null : existing.description,
      location: input.location !== undefined ? input.location?.trim() || null : existing.location,
      video_call_url:
        input.videoCallUrl !== undefined ? input.videoCallUrl?.trim() || null : existing.video_call_url,
      notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
      priority: input.priority !== undefined ? input.priority : existing.priority,
      availability: input.availability ?? existing.availability,
      due_at: input.dueAt !== undefined ? parseDate(input.dueAt) : existing.due_at,
      end_at: input.endAt !== undefined ? parseDate(input.endAt) : existing.end_at,
      completed_at:
        input.markDone === true
          ? existing.completed_at ?? new Date()
          : input.markDone === false
            ? null
            : existing.completed_at,
    },
    include: activityInclude,
  });

  await writeTimelineEvent({
    workspaceId,
    actorUserId,
    contactId: row.contact_id,
    leadId: row.lead_id,
    companyId: row.company_id,
    activityId: row.id,
    eventType: markDone && !existing.completed_at ? "ACTIVITY_COMPLETED" : "ACTIVITY_UPDATED",
    summary: markDone && !existing.completed_at ? `${row.subject} completed` : `${row.subject} updated`,
  });

  return parseActivity(row);
}

export async function listActivitiesForRecord(
  workspaceId: string,
  record: { contactId?: string; leadId?: string; companyId?: string },
): Promise<CrmActivityRecord[]> {
  const rows = await prisma.crmActivity.findMany({
    where: {
      workspace_id: workspaceId,
      contact_id: record.contactId || undefined,
      lead_id: record.leadId || undefined,
      company_id: record.companyId || undefined,
    },
    orderBy: [{ due_at: "asc" }, { created_at: "desc" }],
    include: activityInclude,
  });
  return rows.map(parseActivity);
}

export async function listActivitiesForDay(
  workspaceId: string,
  dayStart: Date,
  dayEnd: Date,
  assigneeUserId?: string,
): Promise<CrmActivityRecord[]> {
  const rows = await prisma.crmActivity.findMany({
    where: {
      workspace_id: workspaceId,
      assignee_user_id: assigneeUserId || undefined,
      due_at: { gte: dayStart, lt: dayEnd },
    },
    orderBy: [{ due_at: "asc" }],
    include: activityInclude,
  });
  return rows.map(parseActivity);
}

export function activityTypeLabel(type: CrmActivityType): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}
