"use client";

import type { CrmActivityType } from "@/lib/crm/activity-shared";

export function ActivityTypeIcon({
  type,
  className = "h-3.5 w-3.5",
}: {
  type: CrmActivityType;
  className?: string;
}) {
  if (type === "CALL") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 3.5h3.5L12 7.5l-2 1.5a12 12 0 005 5l1.5-2 4 1.5V17a2 2 0 01-2 2C8.5 19 5 12.5 5 5.5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "MEETING") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="16" cy="9" r="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.5 18c.7-2.6 2.8-4 4.5-4s3.8 1.4 4.5 4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14 18c.4-1.6 1.5-2.6 2.8-2.6 1.2 0 2.2.8 2.7 2.1" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (type === "TASK") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8v4.5l2.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "DEADLINE") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 20V5h.5l8 4.5L6.5 14H6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "EMAIL") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 11c0-3 2.2-5 5-5s5 2 5 5c0 4-5 8-5 8s-5-4-5-8z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="11" r="1.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
