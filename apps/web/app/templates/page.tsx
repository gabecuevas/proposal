import type { Metadata } from "next";
import Link from "next/link";
import { MARKETING_TEMPLATE_CATEGORIES, wave1Templates } from "@/lib/marketing/template-library";

export const metadata: Metadata = {
  title: "Free Document Templates",
  description:
    "Free NDA, contract, proposal, invoice, HR, and operations templates. Customize online, send for review, and collect e-signatures with SendDox.",
  openGraph: {
    title: "Free Document Templates | SendDox",
    description:
      "SEO-ready template library for agreements, contracts, proposals, sales docs, HR, and business operations.",
  },
};

export default function TemplatesLibraryPage() {
  const featured = wave1Templates();

  return (
    <main className="marketing-shell">
      <section className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Document Templates</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-[#0f2744] md:text-5xl">
            Free template library built for sending, not just downloading.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-[#5b6b7c]">
            Browse high-demand B2B templates—NDAs, contracts, proposals, invoices, HR forms, and more. Each page is
            designed for search discovery and a product loop: use the template, customize, send, track, and e-sign in
            SendDox.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-[#1e3a5f] px-5 py-3 text-sm font-medium text-white hover:bg-[#18324f]"
            >
              Start free
            </Link>
            <Link
              href="#categories"
              className="rounded-lg border border-[#d7dee8] px-5 py-3 text-sm font-medium text-[#0f2744]"
            >
              Browse categories
            </Link>
          </div>
        </div>
      </section>

      <section id="categories" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-semibold text-[#0f2744]">Template categories</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {MARKETING_TEMPLATE_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              href={`/templates/${category.slug}`}
              className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold text-[#0f2744]">{category.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5b6b7c]">{category.description}</p>
              <p className="mt-4 text-sm font-medium text-[#1e3a5f]">View templates →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-[#e2e8f0] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold text-[#0f2744]">Wave 1 priorities</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#5b6b7c]">
            Launch order balances search demand with product-qualified intent—so traffic maps to customize, send, and
            sign workflows.
          </p>
          <ol className="mt-6 grid gap-2 md:grid-cols-2">
            {featured.map((template, index) => (
              <li key={template.slug}>
                <Link
                  href={`/templates/${template.categorySlug}/${template.slug}`}
                  className="flex items-start gap-3 rounded-xl border border-[#eef2f6] px-4 py-3 hover:bg-[#f8fafc]"
                >
                  <span className="mt-0.5 text-xs font-semibold text-[#94a3b8]">{index + 1}</span>
                  <span>
                    <span className="block text-sm font-semibold text-[#0f2744]">{template.name}</span>
                    <span className="mt-0.5 block text-xs text-[#94a3b8]">{template.searchVolumeLabel}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
