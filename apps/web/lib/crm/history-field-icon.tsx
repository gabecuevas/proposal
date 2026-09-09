import type { ReactNode } from "react";

export type HistoryIconId =
  | "status"
  | "tag"
  | "value"
  | "source"
  | "person"
  | "company"
  | "mail"
  | "phone"
  | "title"
  | "pin"
  | "web"
  | "linkedin"
  | "industry"
  | "people"
  | "calendar"
  | "created";

/** Map timeline field keys / history titles to CRM icons. */
export function historyFieldIconId(input: {
  fieldKey?: string | null;
  kind?: "note" | "created" | "change" | "activity";
  title?: string;
}): HistoryIconId | null {
  const key = (input.fieldKey ?? "").toLowerCase();
  if (key) {
    if (key === "phone" || key === "phones") return "phone";
    if (key === "email") return "mail";
    if (key === "website") return "web";
    if (key === "linkedin") return "linkedin";
    if (
      key === "address" ||
      key === "address_line_1" ||
      key === "address_line_2" ||
      key === "city" ||
      key === "state" ||
      key === "postal_code" ||
      key === "country"
    ) {
      return "pin";
    }
    if (key === "company_id" || key === "company_name" || key === "name") return "company";
    if (
      key === "first_name" ||
      key === "last_name" ||
      key === "full_name" ||
      key === "person_id" ||
      key === "converted_to_contact"
    ) {
      return "person";
    }
    if (key === "title" || key === "contact_title") return "title";
    if (key === "status") return "status";
    if (key === "source") return "source";
    if (key === "value_minor" || key === "value") return "value";
    if (key === "industry") return "industry";
    if (key === "primary_contact_id") return "people";
    if (key === "notes") return "title";
    if (key === "tags" || key === "color_label") return "tag";
  }

  const title = (input.title ?? "").toLowerCase();
  if (input.kind === "created" || title.includes("created")) {
    return "created";
  }
  if (title.includes("phone")) return "phone";
  if (title.includes("email")) return "mail";
  if (title.includes("website") || title.includes("web")) return "web";
  if (title.includes("linkedin")) return "linkedin";
  if (title.includes("address")) return "pin";
  if (title.includes("company")) return "company";
  if (title.includes("title")) return "title";
  if (title.includes("status")) return "status";
  if (title.includes("source")) return "source";
  if (title.includes("value")) return "value";
  if (title.includes("industry")) return "industry";
  if (title.includes("person") || title.includes("contact") || title.includes("name")) return "person";

  return null;
}

export function HistoryFieldIcon({
  id,
  className = "h-3.5 w-3.5 shrink-0 text-muted",
}: {
  id: HistoryIconId;
  className?: string;
}): ReactNode {
  if (id === "mail") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "phone") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 3.5h3.5L12 7.5l-2 1.5a12 12 0 005 5l1.5-2 4 1.5V17a2 2 0 01-2 2C8.5 19 5 12.5 5 5.5a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (id === "person") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 19c.8-3 3.2-4.5 7-4.5s6.2 1.5 7 4.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "company") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 20V6l8-3 8 3v14H4z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 20v-6h4v6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "value") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M12 8v8M9.5 10.5c.4-1 1.4-1.5 2.5-1.5s2 .6 2 1.7c0 2.3-4 1.5-4 3.6 0 1.1 1 1.7 2 1.7s2-.5 2.4-1.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === "web") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M4 12h16M12 4c2.5 2.8 3.8 5.6 3.8 8S14.5 17.2 12 20C9.5 17.2 8.2 14.4 8.2 12S9.5 6.8 12 4z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  if (id === "linkedin") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3.5" y="3.5" width="17" height="17" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M8 10.5V16.5M8 8v.01M11.5 16.5v-3.6c0-1.3.8-2.1 1.9-2.1 1.2 0 1.9.8 1.9 2.1v3.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (id === "pin") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "tag" || id === "status") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 12V5h7l8 8-7 7-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="8.2" cy="8.2" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (id === "source") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12h11M12 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "people") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="9" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 18c.5-2.2 2.4-3.5 5-3.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M20 18c-.4-1.6-1.8-2.6-3.8-2.6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (id === "calendar" || id === "created") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "title") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="8" width="16" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 8V6.5A2.5 2.5 0 0110.5 4h3A2.5 2.5 0 0116 6.5V8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 13h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "industry") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20V9l4-2v13M10 20V5l4-2v17M16 20V11l4-2v11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 7h10v3H7V7zM7 14h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
