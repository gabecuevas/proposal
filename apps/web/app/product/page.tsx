import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "SendDox unifies document creation, CRM context, approvals, eSignature, tracking, and payments—from first hello to signed deal.",
};

const sections = [
  {
    id: "documents",
    title: "Documents & templates",
    body: "Build proposals, contracts, invoices, and agreements from reusable masters. Variables, content blocks, quote tables, and page-backed uploads keep every send on-brand and consistent.",
  },
  {
    id: "crm",
    title: "Contacts, leads & calendar",
    body: "Qualify pipeline, book meetings, and keep people and companies beside the documents they belong to—so follow-ups never lose context between tools.",
  },
  {
    id: "approvals",
    title: "Approvals & controls",
    body: "Enforce discount and policy gates before a document can be sent. Keep commercial guardrails without slowing the team that closes deals.",
  },
  {
    id: "esignature",
    title: "Embedded eSignature",
    body: "Ordered signers, field-level permissions, and immutable certificates. Recipients finish in a focused signing experience while you retain the audit trail.",
  },
  {
    id: "tracking",
    title: "Tracking & analytics",
    body: "See delivery, opens, views, comments, and acceptance as they happen. Know when to nudge—and which templates and reps convert.",
  },
  {
    id: "payments",
    title: "Payments",
    body: "Attach Stripe checkout to signed documents so payment status updates with the agreement lifecycle—not in a separate spreadsheet.",
  },
  {
    id: "workflow",
    title: "The SendDox workflow",
    body: "Capture → Engage → Create → Track → Close. Public SEO templates feed the same editor your team uses every day, so acquisition and product stay one loop.",
  },
];

export default function ProductPage() {
  return (
    <main className="marketing-shell">
      <section className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Platform</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-[#0f2744] md:text-5xl">
            Built for the full document journey.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[#5b6b7c]">
            SendDox brings document generation, negotiation, approval, signature, CRM context, and payment into one
            workspace for revenue and operations teams.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-lg bg-[#1e3a5f] px-5 py-3 text-sm font-medium text-white">
              Start free
            </Link>
            <Link href="/templates" className="rounded-lg border border-[#d7dee8] px-5 py-3 text-sm font-medium">
              Free templates
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article
              key={section.id}
              id={section.id}
              className="scroll-mt-24 rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold text-[#0f2744]">{section.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5b6b7c]">{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
