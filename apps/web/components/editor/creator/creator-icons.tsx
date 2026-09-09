import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconSignature({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M3 17c3-1 4-9 6.5-9S12 16 14 16s2.5-3 4-3 1.5 2 3 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M3 20.5h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconInitials({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 5v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M11 15V5l6 10V5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconTextField({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 6h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 6v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconDate({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconFileUpload({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M12 16V4m0 0L8 8m4-4l4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconRadio({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" />
    </Svg>
  );
}

export function IconCheckbox({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 12.5l2.5 2.5L16 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconDropdown({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 11l2 2 2-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconCard({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 14.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconStamp({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M9 4.5h6a2 2 0 012 2v.6a3 3 0 01-.7 1.9L15 11h2.5a2 2 0 012 2v2.5h-15V13a2 2 0 012-2H9L7.7 9a3 3 0 01-.7-1.9v-.6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M4.5 19.5h15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconDragHandle({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="6" r="1.3" fill="currentColor" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" />
    </Svg>
  );
}

export function IconUndo({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M9 7H5V3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 7a8 8 0 105.5-2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconRedo({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M15 7h4V3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 7a8 8 0 10-5.5-2.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconArrowLeft({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M19 12H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M10 7l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M4 4l16 8-16 8 3-8-3-8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPeople({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 19c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20.5 18c-.5-1.9-1.9-3-3.8-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconBraces({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M9 4c-2 0-2 3-2 4s0 4-2 4c2 0 2 3 2 4s0 4 2 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M15 4c2 0 2 3 2 4s0 4 2 4c-2 0-2 3-2 4s0 4-2 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconTable({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 10h17M9.5 10v9" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconChevron({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconChevronRightDouble({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M7 6l6 6-6 6M14 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconPages({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconEye({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function IconDownload({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 18h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconKebab({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </Svg>
  );
}

export function IconEllipsis({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    </Svg>
  );
}

export function IconSliders({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 8h10M18 8h2M4 16h2M10 16h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8" cy="16" r="2.1" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

export function IconBan({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.2 16.8L16.8 7.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconImage({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="M4.5 17.5l4.2-4.2a1.5 1.5 0 012.1 0l2.3 2.3 1.9-1.9a1.5 1.5 0 012.1 0l2.4 2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconVideo({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5v-5z" fill="currentColor" />
    </Svg>
  );
}

export function IconListBullet({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="5" cy="7" r="1.3" fill="currentColor" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="5" cy="17" r="1.3" fill="currentColor" />
      <path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconListOrdered({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M4 5.5h1.2V9M3.6 12h1.8L3.6 14.2h1.8M3.6 16.4h1.8v1.2H3.9v1.2h1.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconQuote({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M9 7c-2.2 0-4 1.8-4 4 0 2.2 1.5 3.5 3 3.5.4 0 .8-.1 1-.2-.3 1.4-1.4 2.4-2.7 2.7M19 7c-2.2 0-4 1.8-4 4 0 2.2 1.5 3.5 3 3.5.4 0 .8-.1 1-.2-.3 1.4-1.4 2.4-2.7 2.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconDivider({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 7h12M6 17h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
    </Svg>
  );
}

export function IconPageBreak({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" />
      <path d="M6 4h12v4H6zM6 16h12v4H6z" stroke="currentColor" strokeWidth="1.4" />
    </Svg>
  );
}

export function IconToc({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h7M4 12h10M4 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 6h3M17 12h3M17 18h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </Svg>
  );
}

export function IconTextT({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 6h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 6v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconBold({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M7 5h5.5a3.5 3.5 0 010 7H7zM7 12h6a3.5 3.5 0 010 7H7z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconItalic({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 5h7M7 19h7M14 5l-4 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function IconUnderline({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 4v7a5 5 0 0010 0V4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 20h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function IconStrike({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 12h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M8 8.5C8 6.6 9.8 5.5 12 5.5s3.6.8 4 2M16 15.5c0 2-1.8 3-4 3s-3.7-1-4-2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconAlignLeft({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M4 12h10M4 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function IconAlignCenter({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M7 12h10M5.5 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function IconAlignRight({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M10 12h10M7 18h13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function IconAlignJustify({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M6.5 7l.8 12a1.5 1.5 0 001.5 1.4h6.4a1.5 1.5 0 001.5-1.4L17.5 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M9.5 7V4.6A1.1 1.1 0 0110.6 3.5h2.8a1.1 1.1 0 011.1 1.1V7" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconPalette({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M12 3.5a8.5 8.5 0 000 17c1.4 0 2-.9 2-1.8 0-1.6-1.6-1.7-1.6-3 0-1 .8-1.7 1.9-1.7h1.4a4.8 4.8 0 004.8-4.8C20.5 5.7 16.7 3.5 12 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8.2" cy="9.2" r="1.2" fill="currentColor" />
      <circle cx="12" cy="7.4" r="1.2" fill="currentColor" />
      <circle cx="15.6" cy="9.2" r="1.2" fill="currentColor" />
    </Svg>
  );
}

export function IconRowPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 14v6M9 17h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconColumnPlus({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="3.5" width="6" height="17" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 9v6M14 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

export function IconCopy({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconDocBadge({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2.5" fill="currentColor" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconGear({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M9.2 3.6h5.6l.7 2.3 2.1.9 2.2-1.1 2.8 4.8-1.6 1.8v2.2l1.6 1.8-2.8 4.8-2.2-1.1-2.1.9-.7 2.3H9.2l-.7-2.3-2.1-.9-2.2 1.1L1.4 15l1.6-1.8v-2.2L1.4 9.2l2.8-4.8 2.2 1.1 2.1-.9.7-2.3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.5" />
    </Svg>
  );
}

export function IconSparkle({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M12 3l1.2 5.3L18 9.5l-4.8 1.2L12 16l-1.2-5.3L6 9.5l4.8-1.2L12 3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M18.5 14.5l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z" fill="currentColor" />
    </Svg>
  );
}

export function IconLibrary({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 6l6-3 8 3v12l-8 3-6-3V6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M11 3v15" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <rect x="13.5" y="9" width="3" height="3" rx="0.4" fill="currentColor" />
      <path d="M14 15h3M14 17h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

export function IconCut({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="6.5" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.5" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.4 8.4L20 19M8.4 15.6L20 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconDuplicate({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="8" y="8" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 16H6.5A1.5 1.5 0 015 14.5v-9A1.5 1.5 0 016.5 4h9A1.5 1.5 0 0117 5.5V8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.2 1.6"
      />
    </Svg>
  );
}

export function IconDuplicatePage({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="7" y="7" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 10v6M10 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M7 16H5.5A1.5 1.5 0 014 14.5v-9A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5V7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.2 1.6"
      />
    </Svg>
  );
}

export function IconComment({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7a2.5 2.5 0 01-2.5 2.5H11l-4 3v-3H7.5A2.5 2.5 0 015 13.5v-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 9.5h.01M9 9.5h.01M15 9.5h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function IconLock({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconLayers({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M12 4l8 4-8 4-8-4 8-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M4 12l8 4 8-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M4 16l8 4 8-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconLink({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M10 13.5l.8.8a3.5 3.5 0 004.95 0l2.12-2.12a3.5 3.5 0 00-4.95-4.95l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 10.5l-.8-.8a3.5 3.5 0 00-4.95 0L6.13 11.82a3.5 3.5 0 004.95 4.95l1.1-1.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconIndent({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M12 12h8M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 9.5v5l4-2.5z" fill="currentColor" />
    </Svg>
  );
}

export function IconOutdent({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 6h16M12 12h8M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 9.5v5L4 12z" fill="currentColor" />
    </Svg>
  );
}

export function IconHighlight({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7 15l-2 4 4-2 8.5-8.5a1.8 1.8 0 00-2.5-2.5L7 15z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

export function IconLineSpacing({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 5v14M8 5l-2.5 2.5M8 5l2.5 2.5M8 19l-2.5-2.5M8 19l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 8h7M13 12h7M13 16h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}
