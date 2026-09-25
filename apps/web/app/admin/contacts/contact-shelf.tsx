"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  IconBuilding,
  IconCalendarPlus,
  IconChat,
  IconClock,
  IconClose,
  IconCopy,
  IconGlobe,
  IconHash,
  IconIdBadge,
  IconLayers,
  IconMail,
  IconPin,
  IconPulse,
  IconSignIn,
  IconUser,
  IconUsers,
} from "./contact-icons";
import { dateOnly, dateTime, statusBadgeClass, timeAgo } from "./format";

type AccountMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  userType: string;
  status: string;
};

type AccountSummary = {
  id: string;
  accountId: string;
  name: string;
  status: string;
  billingFrozen: boolean;
  userCount: number;
  members: AccountMember[];
};

export type ContactDetail = {
  id: string;
  userId: string;
  status: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  sessionCount: number;
  city: string;
  timezone: string;
  account: AccountSummary | null;
  otherAccounts: AccountSummary[];
  conversations: Array<{ id: string; subject: string; status: string }>;
};

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return (parts[0] ?? email).slice(0, 2).toUpperCase();
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={copied ? "Copied" : `Copy ${value}`}
      aria-label={`Copy ${value}`}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center text-slate-400 hover:text-foreground"
    >
      {copied ? <span className="text-[10px] font-semibold text-emerald-600">✓</span> : <IconCopy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-slate-100 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-0.5 flex min-w-0 items-center text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-3">
      <h3 className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`rounded-none border px-1.5 py-0.5 text-xs ${className}`}>{children}</span>;
}

function Truncate({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="truncate" title={title}>
      {children}
    </span>
  );
}

function Mono({ value }: { value: string }) {
  return (
    <>
      <span className="font-mono text-[13px]">{value}</span>
      <CopyButton value={value} />
    </>
  );
}

export function ContactShelf({
  detail,
  loading,
  onClose,
  onSelectUser,
}: {
  detail: ContactDetail | null;
  loading: boolean;
  onClose: () => void;
  onSelectUser: (id: string) => void;
}) {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-start gap-3 px-5 py-4">
        {detail ? (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initials(detail.name, detail.email)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-foreground" title={detail.name}>
                {detail.name}
              </h2>
              <p className="truncate text-sm text-muted" title={detail.email}>
                {detail.email}
              </p>
            </div>
          </>
        ) : (
          <p className="flex-1 text-sm text-muted">{loading ? "Loading…" : "Contact not found"}</p>
        )}
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-foreground"
        >
          <IconClose />
        </button>
      </div>

      {detail ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <Section title="Account" icon={<IconBuilding className="h-3.5 w-3.5" />}>
            {detail.account ? (
              <>
                <Field icon={<IconBuilding />} label="Company name">
                  <Truncate title={detail.account.name}>{detail.account.name}</Truncate>
                </Field>
                <Field icon={<IconPulse />} label="Account status">
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge className={statusBadgeClass(detail.account.status)}>{detail.account.status}</Badge>
                    {detail.account.billingFrozen ? (
                      <Badge className="border-sky-300 bg-sky-50 text-sky-700">Billing frozen</Badge>
                    ) : null}
                  </span>
                </Field>
                <Field icon={<IconHash />} label="Account ID">
                  <Mono value={detail.account.accountId} />
                </Field>
              </>
            ) : (
              <p className="py-2 text-sm text-muted">This user hasn’t created or joined an account yet.</p>
            )}
          </Section>

          <Section title="User" icon={<IconUser className="h-3.5 w-3.5" />}>
            <Field icon={<IconUser />} label="Name of user">
              <Truncate title={detail.name}>{detail.name}</Truncate>
              {detail.status !== "Active" ? (
                <span className="ml-2">
                  <Badge className={statusBadgeClass(detail.status)}>{detail.status}</Badge>
                </span>
              ) : null}
            </Field>
            <Field icon={<IconMail />} label="Email address">
              <Truncate title={detail.email}>{detail.email}</Truncate>
              {!detail.emailVerified ? <span className="ml-2 shrink-0 text-xs text-slate-400">Unverified</span> : null}
            </Field>
            <Field icon={<IconIdBadge />} label="User ID">
              <Mono value={detail.userId} />
            </Field>
            <Field icon={<IconCalendarPlus />} label="Sign-up date">
              {dateOnly(detail.createdAt)}
            </Field>
            <Field icon={<IconSignIn />} label="Last sign-in date">
              {dateTime(detail.lastLoginAt)}
            </Field>
            <Field icon={<IconLayers />} label="Sessions (5+ min)">
              <span className="tabular-nums">{detail.sessionCount}</span>
            </Field>
            <Field icon={<IconClock />} label="Last login">
              {timeAgo(detail.lastLoginAt)}
            </Field>
            <Field icon={<IconPin />} label="City">
              <Truncate title={detail.city}>{detail.city}</Truncate>
            </Field>
            <Field icon={<IconGlobe />} label="Timezone">
              {detail.timezone}
            </Field>
          </Section>

          {detail.account ? (
            <Section
              title={`Users in this account (${detail.account.userCount})`}
              icon={<IconUsers className="h-3.5 w-3.5" />}
            >
              <ul className="divide-y divide-border">
                {detail.account.members.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => onSelectUser(member.id)}
                      disabled={member.id === detail.id}
                      className="flex w-full items-center gap-2 py-2 text-left hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                        {initials(member.name, member.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {member.name}
                          {member.id === detail.id ? <span className="text-muted"> (this user)</span> : null}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-slate-400">
                          {member.userId} · {member.userType}
                        </span>
                      </span>
                      {member.status !== "Active" ? (
                        <Badge className={statusBadgeClass(member.status)}>{member.status}</Badge>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {detail.otherAccounts.length ? (
            <Section title="Other accounts" icon={<IconBuilding className="h-3.5 w-3.5" />}>
              <ul className="space-y-1 py-1 text-sm">
                {detail.otherAccounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{account.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{account.accountId}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {detail.conversations.length ? (
            <Section title="Conversations" icon={<IconChat className="h-3.5 w-3.5" />}>
              <ul className="space-y-1 py-1 text-sm">
                {detail.conversations.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/inbox?c=${c.id}`} className="text-primary hover:underline">
                      {c.subject} <span className="text-muted">({c.status})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
