import type { CrmActivityAvailability, CrmActivityPriority, CrmActivityType } from "@repo/db";

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

export function activityTypeLabel(type: CrmActivityType): string {
  return type.charAt(0) + type.slice(1).toLowerCase();
}
