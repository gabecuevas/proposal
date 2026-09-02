"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CrmActivityAvailability, CrmActivityPriority, CrmActivityType } from "@repo/db";
import { cn } from "@repo/ui/utils";
import {
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_TYPES,
  activityTypeLabel,
  type CrmActivityRecord,
} from "@/lib/crm/activity-shared";
import { ActivityDayCalendar } from "./activity-day-calendar";

export type CrmActivityLinks = {
  contactId?: string;
  contactName?: string;
  leadId?: string;
  leadTitle?: string;
  companyId?: string;
  companyName?: string;
};

type WorkspaceMember = {
  userId: string;
  name: string;
  email: string;
};

type ActivityPanelProps = {
  links: CrmActivityLinks;
  recordSaved: boolean;
  initialType?: CrmActivityType;
  onSaved?: () => void;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function combineDateAndTime(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = new Date(year!, month! - 1, day, hours, minutes, 0, 0);
  return date.toISOString();
}

function defaultSchedule(): { dueDate: string; dueTime: string; endDate: string; endTime: string } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 30 * 60_000);
  const dueDate = toDateInputValue(start);
  return {
    dueDate,
    dueTime: toTimeInputValue(start),
    endDate: dueDate,
    endTime: toTimeInputValue(end),
  };
}

export function ActivityPanel({ links, recordSaved, initialType = "CALL", onSaved }: ActivityPanelProps) {
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const schedule = useMemo(() => defaultSchedule(), []);
  const [activityType, setActivityType] = useState<CrmActivityType>(initialType);
  const [subject, setSubject] = useState(activityTypeLabel(initialType));
  const [priority, setPriority] = useState<CrmActivityPriority | "">("");
  const [availability, setAvailability] = useState<CrmActivityAvailability>("FREE");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [videoCallUrl, setVideoCallUrl] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [dueDate, setDueDate] = useState(schedule.dueDate);
  const [dueTime, setDueTime] = useState(schedule.dueTime);
  const [endDate, setEndDate] = useState(schedule.endDate);
  const [endTime, setEndTime] = useState(schedule.endTime);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [markDone, setMarkDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [calendarDate, setCalendarDate] = useState(() => new Date(schedule.dueDate));
  const [dayActivities, setDayActivities] = useState<CrmActivityRecord[]>([]);

  useEffect(() => {
    void (async () => {
      const [sessionRes, membersRes] = await Promise.all([
        fetch("/api/auth/session"),
        fetch("/api/workspace/members"),
      ]);
      if (sessionRes.ok) {
        const payload = (await sessionRes.json()) as { user?: { userId: string; name: string } | null };
        if (payload.user?.userId) {
          setCurrentUserId(payload.user.userId);
          setAssigneeUserId(payload.user.userId);
        }
      }
      if (membersRes.ok) {
        const payload = (await membersRes.json()) as {
          members: Array<{ userId: string; name: string; email: string }>;
        };
        setMembers(payload.members);
      }
    })();
  }, []);

  const loadDayActivities = useCallback(async () => {
    if (!assigneeUserId) {
      return;
    }
    const params = new URLSearchParams({
      date: toDateInputValue(calendarDate),
      assigneeUserId,
    });
    const response = await fetch(`/api/crm/activities?${params.toString()}`);
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { activities: CrmActivityRecord[] };
    setDayActivities(payload.activities);
  }, [assigneeUserId, calendarDate]);

  useEffect(() => {
    void loadDayActivities();
  }, [loadDayActivities]);

  useEffect(() => {
    const next = new Date(`${dueDate}T00:00:00`);
    if (!Number.isNaN(next.getTime())) {
      setCalendarDate(next);
    }
  }, [dueDate]);

  function selectType(type: CrmActivityType) {
    setActivityType(type);
    if (!subject || CRM_ACTIVITY_TYPES.some((item) => activityTypeLabel(item) === subject)) {
      setSubject(activityTypeLabel(type));
    }
  }

  async function saveActivity() {
    if (!recordSaved) {
      setError("Save the record before scheduling an activity.");
      return;
    }
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/crm/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityType,
        subject,
        priority: priority || null,
        availability,
        notes,
        description: showDescription ? description : null,
        location: showLocation ? location : null,
        videoCallUrl: showVideoCall ? videoCallUrl : null,
        dueAt: combineDateAndTime(dueDate, dueTime),
        endAt: combineDateAndTime(endDate, endTime),
        assigneeUserId,
        contactId: links.contactId,
        leadId: links.leadId,
        companyId: links.companyId,
        markDone,
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("Failed to save activity.");
      return;
    }
    setNotes("");
    setMarkDone(false);
    onSaved?.();
    await loadDayActivities();
  }

  const assigneeLabel = useMemo(() => {
    const member = members.find((item) => item.userId === assigneeUserId);
    if (!member) {
      return "Assignee";
    }
    return member.userId === currentUserId ? `${member.name} (You)` : member.name;
  }, [assigneeUserId, currentUserId, members]);

  if (!recordSaved) {
    return <p className="py-8 text-center text-sm text-muted">Save this record to schedule activities.</p>;
  }

  return (
    <div className="flex min-h-[32rem] flex-col lg:flex-row">
      <div className="min-w-0 flex-1 space-y-3 p-1 pr-3">
        <input
          className="w-full border-0 border-b border-border bg-transparent px-1 py-2 text-2xl font-semibold outline-none focus:border-primary"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Activity subject"
        />

        <div className="flex flex-wrap gap-1">
          {CRM_ACTIVITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs",
                activityType === type
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted hover:bg-slate-50",
              )}
            >
              {activityTypeLabel(type)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <input type="date" className="h-9 rounded border border-border px-2 text-sm" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <input type="time" className="h-9 rounded border border-border px-2 text-sm" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          <input type="date" className="h-9 rounded border border-border px-2 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <input type="time" className="h-9 rounded border border-border px-2 text-sm" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded border border-border px-2 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value as CrmActivityPriority | "")}
          >
            <option value="">Priority</option>
            {CRM_ACTIVITY_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item.charAt(0) + item.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded border border-border px-2 text-sm"
            value={availability}
            onChange={(event) => setAvailability(event.target.value as CrmActivityAvailability)}
          >
            <option value="FREE">Free</option>
            <option value="BUSY">Busy</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-primary">
          <button type="button" onClick={() => setShowLocation((value) => !value)}>
            Add Location
          </button>
          <button type="button" onClick={() => setShowVideoCall((value) => !value)}>
            Video call
          </button>
          <button type="button" onClick={() => setShowDescription((value) => !value)}>
            Description
          </button>
        </div>

        {showLocation ? (
          <input
            className="h-9 w-full rounded border border-border px-2 text-sm"
            placeholder="Location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        ) : null}
        {showVideoCall ? (
          <input
            className="h-9 w-full rounded border border-border px-2 text-sm"
            placeholder="Video call link"
            value={videoCallUrl}
            onChange={(event) => setVideoCallUrl(event.target.value)}
          />
        ) : null}
        {showDescription ? (
          <textarea
            className="min-h-[72px] w-full rounded border border-border px-2 py-1.5 text-sm"
            placeholder="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        ) : null}

        <textarea
          className="min-h-[88px] w-full rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm outline-none"
          placeholder="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <div>
          <label className="mb-1 block text-xs text-muted">Assigned to</label>
          <select
            className="h-9 w-full rounded border border-border px-2 text-sm"
            value={assigneeUserId}
            onChange={(event) => setAssigneeUserId(event.target.value)}
          >
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.userId === currentUserId ? `${member.name} (You)` : member.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">{assigneeLabel}</p>
        </div>

        <div className="space-y-2 rounded border border-border p-2">
          <p className="text-xs font-medium text-muted">Linked records</p>
          {links.leadTitle ? <p className="text-sm">Lead: {links.leadTitle}</p> : null}
          {links.contactName ? <p className="text-sm">Person: {links.contactName}</p> : null}
          {links.companyName ? <p className="text-sm">Organization: {links.companyName}</p> : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={markDone} onChange={(event) => setMarkDone(event.target.checked)} />
            Mark as done
          </label>
          <div className="flex gap-2">
            <button type="button" className="rounded border border-border px-3 py-1.5 text-sm" onClick={() => setError("")}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveActivity()}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-[28rem] w-full shrink-0 lg:mt-0 lg:w-[17rem]">
        <ActivityDayCalendar date={calendarDate} activities={dayActivities} timezone={timezone} />
      </div>
    </div>
  );
}
