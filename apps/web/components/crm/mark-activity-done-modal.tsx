"use client";

import { createPortal } from "react-dom";
import { cn } from "@repo/ui/utils";
import { ActivityTypeIcon } from "@/components/crm/activity-type-icon";
import {
  activityTypeLabel,
  type CrmActivityRecord,
} from "@/lib/crm/activity-shared";
import { activityLinkedRecordLabel } from "@/lib/crm/activity-links";
import { formatGridDateTime } from "@/lib/ui/datetime";

type MarkActivityDoneModalProps = {
  activity: CrmActivityRecord;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function MarkActivityDoneModal({
  activity,
  confirming = false,
  onConfirm,
  onCancel,
}: MarkActivityDoneModalProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const linked = activityLinkedRecordLabel(activity);
  const typeLabel = activityTypeLabel(activity.activity_type);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/30"
        aria-label="Close"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mark-done-title"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-xl"
      >
        <h2 id="mark-done-title" className="text-base font-semibold text-foreground">
          Mark as done
        </h2>
        <p className="mt-1 text-sm text-muted">Are you sure you want to Mark as done?</p>

        <div className="mt-4 space-y-2 rounded-md border border-border bg-slate-50 px-3 py-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ActivityTypeIcon type={activity.activity_type} className="h-4 w-4" />
            <span>{activity.subject || typeLabel}</span>
          </div>
          <p className="text-muted">
            Type: <span className="text-foreground">{typeLabel}</span>
          </p>
          <p className="text-muted">
            Due:{" "}
            <span className="text-foreground">
              {activity.due_at ? formatGridDateTime(activity.due_at) : "Unscheduled"}
            </span>
          </p>
          {activity.assignee_name ? (
            <p className="text-muted">
              Assigned to: <span className="text-foreground">{activity.assignee_name}</span>
            </p>
          ) : null}
          {linked ? (
            <p className="text-muted">
              Linked to: <span className="text-foreground">{linked}</span>
            </p>
          ) : null}
          {activity.company_name && linked !== activity.company_name ? (
            <p className="text-muted">
              Company: <span className="text-foreground">{activity.company_name}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={confirming}
            onClick={onCancel}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm text-foreground hover:bg-slate-50 disabled:opacity-50"
          >
            No
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className={cn(
              "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
            )}
          >
            {confirming ? "Saving…" : "Yes"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
