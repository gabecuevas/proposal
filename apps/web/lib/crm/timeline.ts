import { prisma, type CrmTimelineEventType } from "@repo/db";
import { userDisplayName } from "./display-name";

export type CrmRecordRef = {
  contactId?: string | null;
  leadId?: string | null;
  companyId?: string | null;
};

export type TimelineItem = {
  id: string;
  event_type: CrmTimelineEventType;
  summary: string;
  field_key: string | null;
  field_label: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  activity_id: string | null;
  created_at: string;
};

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function formatFieldChangeSummary(label: string, oldValue: string, newValue: string): string {
  if (!oldValue && newValue) {
    return `${label} added`;
  }
  if (oldValue && !newValue) {
    return `${label} removed`;
  }
  return `${label} changed`;
}

export function diffTrackedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>,
): Array<{ fieldKey: string; fieldLabel: string; oldValue: string; newValue: string; summary: string }> {
  const changes: Array<{ fieldKey: string; fieldLabel: string; oldValue: string; newValue: string; summary: string }> =
    [];
  for (const fieldKey of Object.keys(labels)) {
    if (!(fieldKey in after)) {
      continue;
    }
    const oldValue = normalizeValue(before[fieldKey]);
    const newValue = normalizeValue(after[fieldKey]);
    if (oldValue === newValue) {
      continue;
    }
    const fieldLabel = labels[fieldKey] ?? fieldKey;
    changes.push({
      fieldKey,
      fieldLabel,
      oldValue,
      newValue,
      summary: formatFieldChangeSummary(fieldLabel, oldValue, newValue),
    });
  }
  return changes;
}

type WriteTimelineInput = CrmRecordRef & {
  workspaceId: string;
  actorUserId: string;
  eventType: CrmTimelineEventType;
  summary: string;
  fieldKey?: string;
  fieldLabel?: string;
  oldValue?: string;
  newValue?: string;
  activityId?: string;
};

export async function writeTimelineEvent(input: WriteTimelineInput): Promise<void> {
  await prisma.crmTimelineEvent.create({
    data: {
      workspace_id: input.workspaceId,
      actor_user_id: input.actorUserId,
      contact_id: input.contactId || null,
      lead_id: input.leadId || null,
      company_id: input.companyId || null,
      activity_id: input.activityId || null,
      event_type: input.eventType,
      field_key: input.fieldKey || null,
      field_label: input.fieldLabel || null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      summary: input.summary,
    },
  });

  if (input.contactId) {
    await prisma.contact.update({
      where: { id: input.contactId },
      data: { last_activity_at: new Date() },
    });
  }
}

export async function recordFieldChanges(input: {
  workspaceId: string;
  actorUserId: string;
  record: CrmRecordRef;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  labels: Record<string, string>;
}): Promise<void> {
  const changes = diffTrackedFields(input.before, input.after, input.labels);
  if (changes.length === 0) {
    return;
  }
  await prisma.$transaction(
    changes.map((change) =>
      prisma.crmTimelineEvent.create({
        data: {
          workspace_id: input.workspaceId,
          actor_user_id: input.actorUserId,
          contact_id: input.record.contactId || null,
          lead_id: input.record.leadId || null,
          company_id: input.record.companyId || null,
          event_type: change.fieldKey === "notes" ? "NOTE_SAVED" : "FIELD_CHANGED",
          field_key: change.fieldKey,
          field_label: change.fieldLabel,
          old_value: change.oldValue || null,
          new_value: change.newValue || null,
          summary: change.summary,
        },
      }),
    ),
  );

  if (input.record.contactId) {
    await prisma.contact.update({
      where: { id: input.record.contactId },
      data: { last_activity_at: new Date() },
    });
  }
}

export async function recordRecordCreated(input: {
  workspaceId: string;
  actorUserId: string;
  record: CrmRecordRef;
  summary: string;
}): Promise<void> {
  await writeTimelineEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    contactId: input.record.contactId,
    leadId: input.record.leadId,
    companyId: input.record.companyId,
    eventType: "RECORD_CREATED",
    summary: input.summary,
  });
}

export async function listTimeline(
  workspaceId: string,
  record: CrmRecordRef,
  options?: { limit?: number },
): Promise<TimelineItem[]> {
  const limit = options?.limit ?? 100;
  const rows = await prisma.crmTimelineEvent.findMany({
    where: {
      workspace_id: workspaceId,
      contact_id: record.contactId || undefined,
      lead_id: record.leadId || undefined,
      company_id: record.companyId || undefined,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: limit,
    include: {
      actor: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    summary: row.summary,
    field_key: row.field_key,
    field_label: row.field_label,
    old_value: row.old_value,
    new_value: row.new_value,
    actor_user_id: row.actor_user_id,
    actor_name: userDisplayName(row.actor),
    activity_id: row.activity_id,
    created_at: row.created_at.toISOString(),
  }));
}

export function timelineToDrawerHistory(items: TimelineItem[]): Array<{
  id: string;
  title: string;
  at: string;
  detail?: string;
  kind?: "note" | "created" | "change";
  actorName?: string;
}> {
  return items.map((item) => {
    let kind: "note" | "created" | "change" | undefined;
    if (item.event_type === "RECORD_CREATED") {
      kind = "created";
    } else if (item.event_type === "NOTE_SAVED") {
      kind = "note";
    } else if (item.event_type === "FIELD_CHANGED") {
      kind = "change";
    } else if (
      item.event_type === "ACTIVITY_CREATED" ||
      item.event_type === "ACTIVITY_UPDATED" ||
      item.event_type === "ACTIVITY_COMPLETED"
    ) {
      kind = "note";
    }

    const detail =
      item.new_value && item.event_type === "NOTE_SAVED"
        ? item.new_value
        : item.old_value || item.new_value
          ? [item.old_value, item.new_value].filter(Boolean).join(" → ")
          : undefined;

    return {
      id: item.id,
      title: item.summary,
      at: item.created_at,
      detail: detail || undefined,
      kind,
      actorName: item.actor_name ?? undefined,
    };
  });
}
