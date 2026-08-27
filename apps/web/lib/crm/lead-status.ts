export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "UNQUALIFIED", "CONVERTED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
