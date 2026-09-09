export type DashboardStat = {
  count: number;
  value: number;
};

export type DashboardSeriesPoint = {
  /** ISO date of the week's Monday. */
  start: string;
  count: number;
};

export type DashboardActivityKind =
  | "View"
  | "Sent"
  | "Signed"
  | "Paid"
  | "Comment"
  | "Approval"
  | "Event";

export type DashboardActivityItem = {
  id: string;
  kind: DashboardActivityKind;
  occurredAt: string;
  actor: string;
  documentId: string | null;
  documentTitle: string;
};

export type DashboardOverview = {
  currency: string;
  totals: {
    inProgress: DashboardStat;
    accepted: DashboardStat;
    declined: DashboardStat;
  };
  series: {
    deliveries: DashboardSeriesPoint[];
    views: DashboardSeriesPoint[];
  };
  activity: DashboardActivityItem[];
  teamMemberCount: number;
};

export const emptyStat: DashboardStat = { count: 0, value: 0 };
