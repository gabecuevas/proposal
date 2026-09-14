import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MARKETING_TEMPLATES,
  marketingCategoryBySlug,
  marketingTemplateByPath,
  marketingTemplateHref,
} from "@/lib/marketing/template-library";

type Params = { params: Promise<{ category: string; slug: string }> };

export async function generateStaticParams() {
  return MARKETING_TEMPLATES.map((template) => ({
    category: template.categorySlug,
    slug: template.slug,
  }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category, slug } = await params;
  const template = marketingTemplateByPath(category, slug);
  if (!template) {
    return { title: "Template" };
  }
  return {
    title: template.seoTitle,
    description: template.seoDescription,
    keywords: [
      template.primaryKeyword,
      `free ${template.primaryKeyword}`,
      `${template.primaryKeyword} PDF`,
      `editable ${template.primaryKeyword}`,
    ],
    openGraph: {
      title: template.seoTitle,
      description: template.seoDescription,
      type: "article",
    },
  };
}

export default async function TemplateDetailPage({ params }: Params) {
  const { category: categorySlug, slug } = await params;
  const template = marketingTemplateByPath(categorySlug, slug);
  const category = marketingCategoryBySlug(categorySlug);
  if (!template || !category) {
    notFound();
  }

  const related = (template.relatedSlugs ?? [])
    .map((relatedSlug) => MARKETING_TEMPLATES.find((item) => item.slug === relatedSlug))
    .filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: template.seoTitle,
    description: template.seoDescription,
    about: template.primaryKeyword,
    isPartOf: {
      "@type": "WebSite",
      name: "SendDox",
      url: "https://www.senddox.com",
    },
  };

  return (
    <main className="marketing-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-sm text-[#94a3b8]">
              <Link href="/templates" className="hover:text-[#0f2744]">
                Templates
              </Link>
              <span className="mx-2">/</span>
              <Link href={`/templates/${category.slug}`} className="hover:text-[#0f2744]">
                {category.navLabel}
              </Link>
              <span className="mx-2">/</span>
              <span className="text-[#0f2744]">{template.name}</span>
            </nav>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#0f2744]">
              Free {template.primaryKeyword}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-[#5b6b7c]">{template.summary}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-[#1e3a5f] px-5 py-3 text-sm font-medium text-white hover:bg-[#18324f]"
              >
                Use this template free
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-[#d7dee8] px-5 py-3 text-sm font-medium text-[#0f2744]"
              >
                Log in to customize
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#94a3b8]">
              Search interest: {template.searchVolumeLabel} · Product fit {template.appFit}/5
            </p>
          </div>

          <aside className="rounded-2xl border border-[#e2e8f0] bg-[#f7f8fa] p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">Preview</p>
            <div className="mt-3 rounded-xl border border-[#e2e8f0] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">SendDox template</p>
              <p className="mt-2 text-lg font-semibold text-[#0f2744]">{template.name}</p>
              <div className="mt-4 space-y-2">
                {template.whatIsIncluded.slice(0, 4).map((item) => (
                  <div key={item} className="rounded-md bg-[#f3f6fa] px-3 py-2 text-sm text-[#5b6b7c]">
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-[#94a3b8]">
                Live editor preview will connect to the matching Sample Template once published by an admin.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-[#e2e8f0] bg-white p-5 lg:col-span-1">
          <h2 className="text-lg font-semibold text-[#0f2744]">When to use it</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#5b6b7c]">
            {template.whenToUse.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-[#e2e8f0] bg-white p-5 lg:col-span-1">
          <h2 className="text-lg font-semibold text-[#0f2744]">What is included</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#5b6b7c]">
            {template.whatIsIncluded.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-[#e2e8f0] bg-white p-5 lg:col-span-1">
          <h2 className="text-lg font-semibold text-[#0f2744]">How to customize</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#5b6b7c]">
            {template.howToCustomize.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="border-y border-[#e2e8f0] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-semibold text-[#0f2744]">SendDox workflow for this template</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              ["1. Customize", "Replace variables, pricing, and clauses in the editor."],
              ["2. Approve", "Route discounts or legal review before send when policy requires it."],
              ["3. Send & track", "Share a tracked link and see views and engagement."],
              ["4. e-Sign", "Collect signatures in order and store the certificate."],
            ].map(([title, body]) => (
              <li key={title} className="rounded-xl border border-[#eef2f6] bg-[#f7f8fa] p-4">
                <p className="font-semibold text-[#0f2744]">{title}</p>
                <p className="mt-2 text-sm text-[#5b6b7c]">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs leading-relaxed text-[#94a3b8]">
            Legal disclaimer: Templates are provided for general business use and education. They are not legal advice.
            Have qualified counsel review documents for your jurisdiction and use case before relying on them.
          </p>
        </div>
      </section>

      {related.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold text-[#0f2744]">Related templates</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {related.map((item) =>
              item ? (
                <Link
                  key={item.slug}
                  href={marketingTemplateHref(item)}
                  className="rounded-xl border border-[#e2e8f0] px-4 py-3 hover:bg-white"
                >
                  <p className="text-sm font-semibold text-[#0f2744]">{item.name}</p>
                  <p className="mt-1 text-xs text-[#94a3b8]">{item.primaryKeyword}</p>
                </Link>
              ) : null,
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
