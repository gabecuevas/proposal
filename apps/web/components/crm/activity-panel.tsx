"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_TYPES,
  activityTypeLabel,
  type CrmActivityAvailability,
  type CrmActivityPriority,
  type CrmActivityRecord,
  type CrmActivityType,
} from "@/lib/crm/activity-shared";
import { cn } from "@repo/ui/utils";
import { CrmNotesEditor, noteSaveBlocked } from "@/components/crm/crm-notes-editor";
import { normalizeNoteHtml } from "@/lib/crm/notes-html";
import { ActivityDayCalendar } from "./activity-day-calendar";
import { ActivityTypeIcon } from "./activity-type-icon";
import { MonthCalendarPicker } from "./month-calendar-picker";

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

type VideoProvider = "" | "zoom" | "google_meet" | "microsoft_teams" | "custom";

type ActivityPanelProps = {
  links: CrmActivityLinks;
  recordSaved: boolean;
  initialType?: CrmActivityType;
  editingActivity?: CrmActivityRecord | null;
  onCancelEdit?: () => void;
  onSaved?: (result: { mode: "create" | "edit" }) => void;
};

const VIDEO_PROVIDERS: Array<{ value: VideoProvider; label: string; hint?: string }> = [
  { value: "", label: "Select video provider" },
  { value: "zoom", label: "Zoom", hint: "Connector coming soon" },
  { value: "google_meet", label: "Google Meet", hint: "Connector coming soon" },
  { value: "microsoft_teams", label: "Microsoft Teams", hint: "Connector coming soon" },
  { value: "custom", label: "Custom link" },
];

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

function localDayBounds(dateKey: string): { from: string; to: string } {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function roundToQuarterHour(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  if (rounded === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(rounded);
  }
  return next;
}

function defaultSchedule(): { dueDate: string; dueTime: string; endDate: string; endTime: string } {
  const start = roundToQuarterHour(new Date());
  if (start.getTime() <= Date.now()) {
    start.setMinutes(start.getMinutes() + 15);
  }
  const end = new Date(start.getTime() + 30 * 60_000);
  const dueDate = toDateInputValue(start);
  return {
    dueDate,
    dueTime: toTimeInputValue(start),
    endDate: toDateInputValue(end),
    endTime: toTimeInputValue(end),
  };
}

function formatDisplayDate(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDisplayTime(timeValue: string): string {
  const [hoursRaw, minutesRaw] = timeValue.split(":").map(Number);
  const hours = hoursRaw ?? 0;
  const minutes = minutesRaw ?? 0;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (const minute of [0, 15, 30, 45]) {
      options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();

function FieldIcon({ children }: { children: ReactNode }) {
  return <span className="mt-2 flex w-5 shrink-0 justify-center text-muted">{children}</span>;
}

function FormRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <FieldIcon>{icon}</FieldIcon>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4.5l2.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PriorityIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 12v5M12 12l2.2 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

function BusyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="6" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="8" y="4" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 4h8l4 4v12a1.5 1.5 0 01-1.5 1.5H7A1.5 1.5 0 015.5 20V5.5A1.5 1.5 0 017 4z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M15 4v4h4M8 12h8M8 15.5h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19c.8-3 3.2-4.5 7-4.5s6.2 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 14.5l5-5M8 12H6.5a3.5 3.5 0 010-7H10a3.5 3.5 0 013.3 2.3M16 12h1.5a3.5 3.5 0 010 7H14a3.5 3.5 0 01-3.3-2.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DealIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5v9M9.5 9.5c.5-1 1.5-1.5 2.5-1.5s2 .6 2 1.7c0 2.3-4 1.5-4 3.6 0 1 .9 1.7 2 1.7s1.9-.5 2.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CompanyChipIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V7l8-3 8 3v13" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 20v-5h6v5M10 10h1M13 10h1M10 13h1M13 13h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DropdownField({
  valueLabel,
  open,
  onToggle,
  children,
  className,
  buttonClassName,
  menuClassName,
}: {
  valueLabel: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "inline-flex h-9 min-w-[5.5rem] items-center justify-between gap-2 rounded border border-border bg-white px-2.5 text-sm text-foreground hover:bg-slate-50",
          buttonClassName,
        )}
      >
        <span className="whitespace-nowrap">{valueLabel}</span>
        <span className="text-muted" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          className={cn(
            "absolute z-30 mt-1 max-h-56 min-w-full overflow-y-auto rounded-md border border-border bg-white py-1 shadow-lg",
            menuClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ActivityPanel({
  links,
  recordSaved,
  initialType = "CALL",
  editingActivity = null,
  onCancelEdit,
  onSaved,
}: ActivityPanelProps) {
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const schedule = useMemo(() => defaultSchedule(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const [activityType, setActivityType] = useState<CrmActivityType>(initialType);
  const [subject, setSubject] = useState(activityTypeLabel(initialType));
  const [priority, setPriority] = useState<CrmActivityPriority | "">("");
  const [availability, setAvailability] = useState<CrmActivityAvailability>("BUSY");
  const [notes, setNotes] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [videoCallUrl, setVideoCallUrl] = useState("");
  const [videoProvider, setVideoProvider] = useState<VideoProvider>("");
  const [showDescription, setShowDescription] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [dueDate, setDueDate] = useState(schedule.dueDate);
  const [dueTime, setDueTime] = useState(schedule.dueTime);
  const [endDate, setEndDate] = useState(schedule.endDate);
  const [endTime, setEndTime] = useState(schedule.endTime);
  const [openMenu, setOpenMenu] = useState<"startDate" | "startTime" | "endDate" | "endTime" | null>(null);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [markDone, setMarkDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [calendarDate, setCalendarDate] = useState(() => new Date(`${schedule.dueDate}T00:00:00`));
  const [dayActivities, setDayActivities] = useState<CrmActivityRecord[]>([]);
  const [notesEditorKey, setNotesEditorKey] = useState(0);
  const isEditing = Boolean(editingActivity?.id);

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
          setAssigneeUserId((current) => current || payload.user!.userId);
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

  useEffect(() => {
    if (!editingActivity) {
      return;
    }
    const due = editingActivity.due_at ? new Date(editingActivity.due_at) : null;
    const end = editingActivity.end_at ? new Date(editingActivity.end_at) : null;
    setActivityType(editingActivity.activity_type);
    setSubject(editingActivity.subject || activityTypeLabel(editingActivity.activity_type));
    setPriority(editingActivity.priority ?? "");
    setAvailability(editingActivity.availability);
    setNotes(editingActivity.notes ?? "");
    setDescription(editingActivity.description ?? "");
    setLocation(editingActivity.location ?? "");
    setVideoCallUrl(editingActivity.video_call_url ?? "");
    setShowDescription(Boolean(editingActivity.description));
    setShowLocation(Boolean(editingActivity.location));
    setShowVideoCall(Boolean(editingActivity.video_call_url));
    setMarkDone(Boolean(editingActivity.completed_at));
    if (due && !Number.isNaN(due.getTime())) {
      setDueDate(toDateInputValue(due));
      setDueTime(toTimeInputValue(due));
      setCalendarDate(new Date(`${toDateInputValue(due)}T00:00:00`));
    }
    if (end && !Number.isNaN(end.getTime())) {
      setEndDate(toDateInputValue(end));
      setEndTime(toTimeInputValue(end));
    }
    if (editingActivity.assignee_user_id) {
      setAssigneeUserId(editingActivity.assignee_user_id);
    }
    setNotesEditorKey((key) => key + 1);
    setError("");
  }, [editingActivity]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const loadDayActivities = useCallback(async () => {
    if (!assigneeUserId) {
      return;
    }
    const dateKey = toDateInputValue(calendarDate);
    const bounds = localDayBounds(dateKey);
    const params = new URLSearchParams({
      date: dateKey,
      from: bounds.from,
      to: bounds.to,
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

  useEffect(() => {
    const start = new Date(combineDateAndTime(dueDate, dueTime));
    const end = new Date(combineDateAndTime(endDate, endTime));
    if (end.getTime() <= start.getTime()) {
      const nextEnd = new Date(start.getTime() + 30 * 60_000);
      setEndDate(toDateInputValue(nextEnd));
      setEndTime(toTimeInputValue(nextEnd));
    }
  }, [dueDate, dueTime, endDate, endTime]);

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
    const nextNotes = normalizeNoteHtml(notes);
    if (noteSaveBlocked(nextNotes)) {
      setError("Note exceeds the 100KB size limit.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      activityType,
      subject,
      priority: priority || null,
      availability,
      notes: nextNotes || null,
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
    };
    const response = await fetch(
      isEditing ? `/api/crm/activities/${editingActivity!.id}` : "/api/crm/activities",
      {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!response.ok) {
      setError(isEditing ? "Failed to update activity." : "Failed to save activity.");
      return;
    }
    setNotes("");
    setNotesEditorKey((key) => key + 1);
    setMarkDone(false);
    onSaved?.({ mode: isEditing ? "edit" : "create" });
    await loadDayActivities();
  }

  function handleCancel() {
    setError("");
    if (isEditing) {
      onCancelEdit?.();
      return;
    }
  }

  const draftActivity = useMemo<CrmActivityRecord | null>(() => {
    if (!dueDate || !dueTime) {
      return null;
    }
    return {
      id: editingActivity?.id ?? "draft",
      workspace_id: "",
      created_by_user_id: currentUserId,
      assignee_user_id: assigneeUserId || null,
      contact_id: links.contactId ?? null,
      lead_id: links.leadId ?? null,
      company_id: links.companyId ?? null,
      activity_type: activityType,
      subject: subject.trim() || activityTypeLabel(activityType),
      description: description || null,
      location: location || null,
      video_call_url: videoCallUrl || null,
      notes: notes || null,
      priority: priority || null,
      availability,
      due_at: combineDateAndTime(dueDate, dueTime),
      end_at: combineDateAndTime(endDate, endTime),
      completed_at: markDone ? new Date().toISOString() : null,
      created_at: editingActivity?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignee_name: null,
      created_by_name: null,
    };
  }, [
    activityType,
    assigneeUserId,
    availability,
    currentUserId,
    description,
    dueDate,
    dueTime,
    editingActivity?.created_at,
    editingActivity?.id,
    endDate,
    endTime,
    links.companyId,
    links.contactId,
    links.leadId,
    location,
    markDone,
    notes,
    priority,
    subject,
    videoCallUrl,
  ]);

  const calendarActivities = useMemo(() => {
    if (!draftActivity) {
      return dayActivities;
    }
    return [
      ...dayActivities.filter((item) => item.id !== draftActivity.id && item.id !== "draft"),
      draftActivity,
    ];
  }, [dayActivities, draftActivity]);

  if (!recordSaved) {
    return <p className="py-8 text-center text-sm text-muted">Save this record to schedule activities.</p>;
  }

  return (
    <div ref={rootRef} className="flex min-h-[32rem] flex-col lg:flex-row">
      <div className="min-w-0 flex-1 space-y-3 p-1 pr-3">
        <input
          className="w-full border-0 border-b border-border bg-transparent px-1 py-2 text-2xl font-semibold outline-none focus:border-primary"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Activity subject"
        />

        <div className="flex flex-wrap gap-1.5">
          {CRM_ACTIVITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => selectType(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] font-bold",
                activityType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-white text-foreground hover:bg-slate-50",
              )}
            >
              <ActivityTypeIcon type={type} className="h-4 w-4 shrink-0" />
              <span>{activityTypeLabel(type)}</span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <FormRow icon={<ClockIcon />}>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownField
                valueLabel={formatDisplayDate(dueDate)}
                open={openMenu === "startDate"}
                onToggle={() => setOpenMenu((value) => (value === "startDate" ? null : "startDate"))}
                buttonClassName="min-w-[8.5rem]"
                menuClassName="max-h-none min-w-0 p-0"
              >
                <MonthCalendarPicker
                  value={dueDate}
                  onChange={(next) => {
                    setDueDate(next);
                    if (endDate < next) {
                      setEndDate(next);
                    }
                    setOpenMenu(null);
                  }}
                />
              </DropdownField>

              <DropdownField
                valueLabel={formatDisplayTime(dueTime)}
                open={openMenu === "startTime"}
                onToggle={() => setOpenMenu((value) => (value === "startTime" ? null : "startTime"))}
                buttonClassName="min-w-[6.75rem]"
                menuClassName="min-w-[7.5rem]"
              >
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between whitespace-nowrap px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                      option === dueTime && "bg-primary/10 text-primary",
                    )}
                    onClick={() => {
                      setDueTime(option);
                      setOpenMenu(null);
                    }}
                  >
                    {formatDisplayTime(option)}
                    {option === dueTime ? <span>✓</span> : null}
                  </button>
                ))}
              </DropdownField>

              <span className="px-1 text-muted">–</span>

              {endDate !== dueDate ? (
                <DropdownField
                  valueLabel={formatDisplayDate(endDate)}
                  open={openMenu === "endDate"}
                  onToggle={() => setOpenMenu((value) => (value === "endDate" ? null : "endDate"))}
                  buttonClassName="min-w-[8.5rem]"
                  menuClassName="max-h-none min-w-0 p-0"
                >
                  <MonthCalendarPicker
                    value={endDate}
                    min={dueDate}
                    onChange={(next) => {
                      setEndDate(next);
                      setOpenMenu(null);
                    }}
                  />
                </DropdownField>
              ) : null}

              <DropdownField
                valueLabel={formatDisplayTime(endTime)}
                open={openMenu === "endTime"}
                onToggle={() => setOpenMenu((value) => (value === "endTime" ? null : "endTime"))}
                buttonClassName="min-w-[6.75rem]"
                menuClassName="min-w-[7.5rem]"
              >
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between whitespace-nowrap px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                      option === endTime && "bg-primary/10 text-primary",
                    )}
                    onClick={() => {
                      setEndTime(option);
                      setOpenMenu(null);
                    }}
                  >
                    {formatDisplayTime(option)}
                    {option === endTime ? <span>✓</span> : null}
                  </button>
                ))}
              </DropdownField>

              {endDate === dueDate ? (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    const next = new Date(`${dueDate}T00:00:00`);
                    next.setDate(next.getDate() + 1);
                    setEndDate(toDateInputValue(next));
                  }}
                >
                  Add end date
                </button>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted hover:underline"
                  onClick={() => setEndDate(dueDate)}
                >
                  Same day
                </button>
              )}
            </div>
          </FormRow>

          <FormRow icon={<PriorityIcon />}>
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
          </FormRow>

          <FormRow icon={<MoreIcon />}>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  className={cn("font-medium", showLocation ? "text-foreground" : "text-primary")}
                  onClick={() => setShowLocation((value) => !value)}
                >
                  {showLocation ? "Location" : "Add Location"}
                </button>
                <button
                  type="button"
                  className={cn("font-medium", showVideoCall ? "text-foreground" : "text-primary")}
                  onClick={() => setShowVideoCall((value) => !value)}
                >
                  Video call
                </button>
                <button
                  type="button"
                  className={cn("font-medium", showDescription ? "text-foreground" : "text-primary")}
                  onClick={() => setShowDescription((value) => !value)}
                >
                  Description
                </button>
              </div>
              {showLocation ? (
                <input
                  className="h-9 w-full rounded border border-border px-2 text-sm"
                  placeholder="Add location"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              ) : null}
              {showVideoCall ? (
                <div className="space-y-2 rounded border border-border p-2">
                  <select
                    className="h-9 w-full rounded border border-border px-2 text-sm"
                    value={videoProvider}
                    onChange={(event) => setVideoProvider(event.target.value as VideoProvider)}
                  >
                    {VIDEO_PROVIDERS.map((provider) => (
                      <option key={provider.value || "none"} value={provider.value}>
                        {provider.label}
                        {provider.hint ? ` (${provider.hint})` : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-9 w-full rounded border border-border px-2 text-sm"
                    placeholder="Paste meeting link"
                    value={videoCallUrl}
                    onChange={(event) => setVideoCallUrl(event.target.value)}
                  />
                  {videoProvider && videoProvider !== "custom" ? (
                    <p className="text-xs text-muted">
                      {VIDEO_PROVIDERS.find((item) => item.value === videoProvider)?.label} connector coming soon —
                      paste a meeting link for now.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {showDescription ? (
                <textarea
                  className="min-h-[72px] w-full rounded border border-border px-2 py-1.5 text-sm"
                  placeholder="Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              ) : null}
            </div>
          </FormRow>

          <FormRow icon={<BusyIcon />}>
            <select
              className="h-9 rounded border border-border px-2 text-sm"
              value={availability}
              onChange={(event) => setAvailability(event.target.value as CrmActivityAvailability)}
            >
              <option value="BUSY">Busy</option>
              <option value="FREE">Free</option>
            </select>
          </FormRow>

          <FormRow icon={<NotesIcon />}>
            <CrmNotesEditor
              contentKey={String(notesEditorKey)}
              value={notes}
              onChange={setNotes}
              members={members}
              currentUserId={currentUserId}
              placeholder="Notes"
              minHeightClassName="min-h-[88px]"
            />
          </FormRow>

          <FormRow icon={<PersonIcon />}>
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
          </FormRow>

          <FormRow icon={<LinkIcon />}>
            <div className="flex flex-wrap gap-1.5">
              {links.leadTitle ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs text-foreground">
                  <DealIcon />
                  {links.leadTitle}
                </span>
              ) : null}
              {links.contactName ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs text-foreground">
                  <PersonIcon />
                  {links.contactName}
                </span>
              ) : null}
              {links.companyName ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs text-foreground">
                  <CompanyChipIcon />
                  {links.companyName}
                </span>
              ) : null}
              {!links.leadTitle && !links.contactName && !links.companyName ? (
                <span className="text-sm text-muted">No linked records</span>
              ) : null}
            </div>
          </FormRow>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={markDone} onChange={(event) => setMarkDone(event.target.checked)} />
            Mark as done
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border px-3 py-1.5 text-sm"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || noteSaveBlocked(notes)}
              onClick={() => void saveActivity()}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {isEditing ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 min-h-[28rem] w-full shrink-0 lg:mt-0 lg:w-[18rem]">
        <ActivityDayCalendar
          date={calendarDate}
          activities={calendarActivities}
          timezone={timezone}
          draftId="draft"
        />
      </div>
    </div>
  );
}
