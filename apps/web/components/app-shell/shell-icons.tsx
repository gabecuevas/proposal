import type { ReactNode } from "react";

export function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDocument({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16 4v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTemplates({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function IconContacts({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 18c.5-2.2 2.5-3.5 5-3.5s4.5 1.3 5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="17" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M21 18c-.5-1.6-2-2.5-4-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconMore({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconPuzzle({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 4h3a1 1 0 011 1v1.5a1.5 1.5 0 003 0V5a1 1 0 011-1h1a2 2 0 012 2v3a1 1 0 01-1 1h-1.5a1.5 1.5 0 000 3H20a1 1 0 011 1v3a2 2 0 01-2 2h-3v-1.5a1.5 1.5 0 00-3 0V20a1 1 0 01-1 1h-3a2 2 0 01-2-2v-3a1 1 0 011-1h1.5a1.5 1.5 0 000-3H7a1 1 0 01-1-1V7a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 19c.8-2.2 3-3.5 5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconMenu({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9a6 6 0 1112 0v4l1.5 3h-15L6 13V9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconPower({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M7.5 6.5a7 7 0 109 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StatusIcon({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

export function IconInProgress({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <path
        d="M4 11.5l16-7-7 16-2.2-6.8L4 11.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </StatusIcon>
  );
}

export function IconCompleted({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 12.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </StatusIcon>
  );
}

export function IconViewed({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <path
        d="M3.5 12s3.2-6 8.5-6 8.5 6 8.5 6-3.2 6-8.5 6-8.5-6-8.5-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </StatusIcon>
  );
}

export function IconUnviewed({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 8l8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </StatusIcon>
  );
}

export function IconDeclined({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </StatusIcon>
  );
}

export function IconDraft({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <path
        d="M7 4h7l4 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 4v4h4M8.5 13h5M8.5 16h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </StatusIcon>
  );
}

export function IconArchived({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <path d="M4 6.5h16v3H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M5.5 9.5V18a1 1 0 001 1h11a1 1 0 001-1V9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </StatusIcon>
  );
}

export function IconPending({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <path
        d="M7 4h10v2.2L13.2 12 17 17.8V20H7v-2.2L10.8 12 7 6.2V4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </StatusIcon>
  );
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <StatusIcon className={className}>
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path
        d="M6.5 7l.8 13h9.4l.8-13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </StatusIcon>
  );
}

export const documentNavIcons = {
  inProgress: IconInProgress,
  completed: IconCompleted,
  viewed: IconViewed,
  unviewed: IconUnviewed,
  declined: IconDeclined,
  draft: IconDraft,
  archived: IconArchived,
  pending: IconPending,
  trash: IconTrash,
} as const;

export function IconLibrary({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h5v14H4zM10.5 5h4v14h-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16.2 5.6l3.4.9-3.2 12.1-3.4-.9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSettings({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
