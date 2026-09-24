import Link from "next/link";
import { MARKETING_TEMPLATE_CATEGORIES, wave1Templates } from "@/lib/marketing/template-library";

function MockWindow({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="marketing-float overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
      <div className="flex items-center gap-2 border-b border-[#eef2f6] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#d7dee8]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#d7dee8]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#d7dee8]" />
        <p className="ml-2 text-xs font-medium text-[#64748b]">{title}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function StepCard({
  index,
  title,
  body,
}: {
  index: string;
  title: string;
  body: string;
}) {
  return (
    <article className="marketing-rise rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">{index}</p>
      <h3 className="mt-2 text-lg font-semibold text-[#0f2744]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#5b6b7c]">{body}</p>
    </article>
  );
}

export function MarketingHomePage() {
  const featured = wave1Templates().slice(0, 6);

  return (
    <main className="marketing-shell">
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:py-24">
        <div className="marketing-rise">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">
            Document automation platform
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-[#0f2744] sm:text-5xl md:text-6xl">
            Move every deal forward.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#5b6b7c]">
            Create documents, coordinate your team, engage prospects, and know exactly what happens next—from qualified
            lead to signed agreement to payment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-none bg-[#1e3a5f] px-5 py-3 text-sm font-medium text-white hover:bg-[#18324f]"
            >
              Start free
            </Link>
            <Link
              href="/product#workflow"
              className="rounded-none border border-[#d7dee8] bg-white px-5 py-3 text-sm font-medium text-[#0f2744] hover:bg-[#f8fafc]"
            >
              Explore the workflow
            </Link>
          </div>
          <p className="mt-6 text-sm text-[#94a3b8]">
            Templates → customize → send → track → e-sign → get paid. One workspace, no handoff gaps.
          </p>
        </div>

        <MockWindow title="SendDox · Live pipeline">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0f2744]">Qualified pipeline</p>
              <span className="rounded-full bg-[#e8eef5] px-2 py-0.5 text-[11px] font-medium text-[#1e3a5f]">
                Contacts / Leads
              </span>
            </div>
            {[
              { name: "Acme Corp", stage: "Proposal review", tone: "bg-[#1e3a5f]" },
              { name: "Northstar", stage: "Discovery booked", tone: "bg-[#3b82f6]" },
              { name: "Brightline", stage: "MSA out for signature", tone: "bg-[#0f766e]" },
            ].map((row) => (
              <div
                key={row.name}
                className="marketing-pulse flex items-center justify-between rounded-xl border border-[#eef2f6] px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-[#0f2744]">{row.name}</p>
                  <p className="text-xs text-[#64748b]">{row.stage}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${row.tone}`} />
              </div>
            ))}
            <div className="rounded-xl bg-[#f3f6fa] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Next action</p>
              <p className="mt-1 text-sm text-[#0f2744]">Follow up on Acme proposal — viewed 4 times today</p>
            </div>
          </div>
        </MockWindow>
      </section>

      <section className="border-y border-[#e2e8f0] bg-white/70">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-10 sm:px-6 md:grid-cols-4">
          {[
            ["Capture → Close", "Leads, meetings, docs, signatures"],
            ["Template library", "SEO hubs + in-app masters"],
            ["Live tracking", "Views, comments, acceptance"],
            ["Payments ready", "Stripe after signature"],
          ].map(([title, body]) => (
            <div key={title} className="rounded-xl border border-[#eef2f6] bg-white p-4">
              <p className="text-sm font-semibold text-[#0f2744]">{title}</p>
              <p className="mt-1 text-sm text-[#5b6b7c]">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">01 · Engage</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0f2744] md:text-4xl">
            Turn interest into a real conversation.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[#5b6b7c]">
            Keep every lead, meeting, and follow-up in one place—so momentum never disappears between CRM tabs, inboxes,
            and spreadsheets.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <MockWindow title="Contacts · Calendar">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#94a3b8]">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
              {Array.from({ length: 21 }, (_, index) => (
                <div key={index} className="min-h-12 rounded-md border border-[#eef2f6] p-1 text-left">
                  <span className="text-[10px] text-[#64748b]">{index + 1}</span>
                  {index === 4 || index === 11 || index === 15 ? (
                    <div className="mt-1 truncate rounded bg-[#1e3a5f] px-1 py-0.5 text-[9px] text-white">
                      {index === 4 ? "Discovery" : index === 11 ? "Proposal" : "Decision"}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </MockWindow>
          <div className="flex flex-col justify-center gap-4">
            <StepCard
              index="Capture"
              title="Qualify leads"
              body="Score and assign inbound interest, then book the next conversation without leaving SendDox."
            />
            <StepCard
              index="Engage"
              title="Book meetings"
              body="Calendar context sits next to the account—so every demo and follow-up has the full story."
            />
          </div>
        </div>
      </section>

      <section className="bg-[#0f2744] text-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/50">02 · Create</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Build the deal together.</h2>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Draft proposals, agreements, and invoices with pricing, comments, approvals, and your team already in
              context. Start from an SEO template or your private library—then send without retyping.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/80">
              <li>• Variables, content blocks, and quote tables</li>
              <li>• Discount approvals before a document can leave the building</li>
              <li>• Signer fields, order, and audit-ready certificates</li>
            </ul>
            <Link
              href="/templates"
              className="mt-8 inline-flex rounded-none bg-white px-5 py-3 text-sm font-medium text-[#0f2744] hover:bg-[#f8fafc]"
            >
              Browse free templates
            </Link>
          </div>
          <MockWindow title="Documents · Growth Partnership Proposal">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Acme, Inc.</p>
            <h3 className="mt-1 text-xl font-semibold text-[#0f2744]">Growth Partnership Proposal</h3>
            <p className="mt-2 text-sm text-[#5b6b7c]">
              A unified plan to accelerate your sales workflow, from first conversation through signature.
            </p>
            <div className="mt-4 space-y-2">
              {["Executive summary", "Recommended package", "Investment", "Acceptance"].map((item) => (
                <div key={item} className="rounded-none border border-[#eef2f6] px-3 py-2 text-sm text-[#0f2744]">
                  {item}
                </div>
              ))}
            </div>
          </MockWindow>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">03 · Track & close</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0f2744] md:text-4xl">
            Know what happens next.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[#5b6b7c]">
            See delivery, views, comments, and acceptance as they happen. Follow up at the right moment—with the full
            story in view—then collect signatures and payment without switching tools.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <StepCard
            index="Track"
            title="Live document activity"
            body="Know who opened the proposal, which pages they lingered on, and when to nudge."
          />
          <StepCard
            index="Sign"
            title="eSignature that sticks"
            body="Ordered signers, field permissions, and certificates your ops and legal teams can trust."
          />
          <StepCard
            index="Paid"
            title="Close the loop"
            body="Attach Stripe checkout after signature so revenue status updates with the document."
          />
        </div>
      </section>

      <section className="border-y border-[#e2e8f0] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">One flow</p>
              <h2 className="mt-2 text-3xl font-semibold text-[#0f2744]">From first hello to signed deal.</h2>
            </div>
            <Link href="/product" className="text-sm font-medium text-[#1e3a5f] hover:underline">
              See full platform →
            </Link>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-5">
            {[
              ["Capture", "Qualify leads"],
              ["Engage", "Book meetings"],
              ["Create", "Build documents"],
              ["Track", "See activity"],
              ["Close", "Win the deal"],
            ].map(([title, body], index) => (
              <div key={title} className="rounded-2xl border border-[#e2e8f0] bg-[#f7f8fa] p-4">
                <p className="text-[11px] font-semibold text-[#94a3b8]">0{index + 1}</p>
                <p className="mt-2 font-semibold text-[#0f2744]">{title}</p>
                <p className="mt-1 text-sm text-[#5b6b7c]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Document Templates</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#0f2744]">Free templates that become real workflows.</h2>
            <p className="mt-3 text-[#5b6b7c]">
              Public SEO pages introduce SendDox. “Use this template” takes visitors into customize → send → e-sign—so
              acquisition and product stay one loop.
            </p>
          </div>
          <Link
            href="/templates"
            className="rounded-none border border-[#d7dee8] bg-white px-4 py-2.5 text-sm font-medium text-[#0f2744] hover:bg-[#f8fafc]"
          >
            Open template library
          </Link>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETING_TEMPLATE_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/templates/${category.slug}`}
              className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold text-[#0f2744]">{category.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#5b6b7c]">{category.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((template) => (
            <Link
              key={template.slug}
              href={`/templates/${template.categorySlug}/${template.slug}`}
              className="rounded-xl border border-[#eef2f6] px-4 py-3 hover:border-[#1e3a5f]/30 hover:bg-white"
            >
              <p className="text-sm font-semibold text-[#0f2744]">{template.name}</p>
              <p className="mt-1 text-xs text-[#94a3b8]">{template.searchVolumeLabel}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-[#e2e8f0] bg-[#f3f6fa]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold text-[#0f2744]">One workspace. No handoff gaps.</h2>
            <p className="mt-3 text-[#5b6b7c]">
              Bring documents, customer relationships, and team collaboration into one focused sales workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-none bg-[#1e3a5f] px-5 py-3 text-sm font-medium text-white hover:bg-[#18324f]"
            >
              Talk to SendDox — start free
            </Link>
            <Link
              href="/contact"
              className="rounded-none border border-[#d7dee8] bg-white px-5 py-3 text-sm font-medium text-[#0f2744]"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
