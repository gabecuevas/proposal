import type { CrmActivityRecord } from "@/lib/crm/activity-shared";

/** Prefer lead → person → company for deep-linking from an activity. */
export function activityLinkedRecordHref(activity: CrmActivityRecord): string | null {
  if (activity.lead_id) {
    return `/app/contacts/leads?open=${encodeURIComponent(activity.lead_id)}`;
  }
  if (activity.contact_id) {
    return `/app/contacts/people?open=${encodeURIComponent(activity.contact_id)}`;
  }
  if (activity.company_id) {
    return `/app/contacts/companies?open=${encodeURIComponent(activity.company_id)}`;
  }
  return null;
}

export function activityLinkedRecordLabel(activity: CrmActivityRecord): string | null {
  if (activity.lead_id) {
    return activity.lead_title || activity.contact_name || "Lead";
  }
  if (activity.contact_id) {
    return activity.contact_name || "Person";
  }
  if (activity.company_id) {
    return activity.company_name || "Company";
  }
  return null;
}
