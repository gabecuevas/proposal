import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MARKETING_TEMPLATE_CATEGORIES,
  marketingCategoryBySlug,
  marketingTemplatesByCategory,
} from "@/lib/marketing/template-library";

type Params = { params: Promise<{ category: string }> };

export async function generateStaticParams() {
  return MARKETING_TEMPLATE_CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = marketingCategoryBySlug(categorySlug);
  if (!category) {
    return { title: "Templates" };
  }
  return {
    title: category.seoTitle,
    description: category.seoDescription,
    openGraph: {
      title: category.seoTitle,
      description: category.seoDescription,
    },
  };
}

export default async function TemplateCategoryPage({ params }: Params) {
  const { category: categorySlug } = await params;
  const category = marketingCategoryBySlug(categorySlug);
  if (!category) {
    notFound();
  }
  const templates = marketingTemplatesByCategory(category.slug);

  return (
    <main className="marketing-shell">
      <section className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <nav aria-label="Breadcrumb" className="text-sm text-[#94a3b8]">
            <Link href="/templates" className="hover:text-[#0f2744]">
              Document Templates
            </Link>
            <span className="mx-2">/</span>
            <span className="text-[#0f2744]">{category.navLabel}</span>
          </nav>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#0f2744]">{category.name}</h1>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-[#5b6b7c]">{category.description}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((template) => (
            <Link
              key={template.slug}
              href={`/templates/${template.categorySlug}/${template.slug}`}
              className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#0f2744]">{template.name}</h2>
                {template.wave1 ? (
                  <span className="shrink-0 rounded-full bg-[#e8eef5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1e3a5f]">
                    Wave 1
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#5b6b7c]">{template.summary}</p>
              <p className="mt-3 text-xs text-[#94a3b8]">{template.searchVolumeLabel}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-[#e2e8f0] bg-[#f3f6fa] p-6">
          <h2 className="text-lg font-semibold text-[#0f2744]">Use these templates in SendDox</h2>
          <p className="mt-2 text-sm text-[#5b6b7c]">
            Start free, customize with variables and pricing, send for review, and collect e-signatures—without leaving
            the workspace.
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-flex rounded-none bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white"
          >
            Use templates free
          </Link>
        </div>
      </section>
    </main>
  );
}
