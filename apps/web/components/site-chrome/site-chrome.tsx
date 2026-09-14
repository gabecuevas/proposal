"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@repo/ui/utils";
import { SendDoxLogo } from "@/components/brand/senddox-logo";
import { MARKETING_TEMPLATE_CATEGORIES } from "@/lib/marketing/template-library";

function useMarketingChromeVisible() {
  const pathname = usePathname();
  return !pathname.startsWith("/app") && !pathname.startsWith("/sign/");
}

type MegaItem = { href: string; title: string; description: string };

const platformItems: MegaItem[] = [
  {
    href: "/product#documents",
    title: "Documents & templates",
    description: "Build proposals, contracts, and agreements with variables, pricing, and content blocks.",
  },
  {
    href: "/product#approvals",
    title: "Approvals & controls",
    description: "Route discounts and sensitive terms through policy-based approvals before send.",
  },
  {
    href: "/product#esignature",
    title: "eSignature",
    description: "Signer order, field-level permissions, and immutable certificate evidence.",
  },
  {
    href: "/product#payments",
    title: "Payments",
    description: "Attach Stripe checkout to signed documents and mark deals paid automatically.",
  },
  {
    href: "/product#crm",
    title: "Contacts & calendar",
    description: "Keep leads, people, companies, meetings, and follow-ups beside every document.",
  },
  {
    href: "/product#tracking",
    title: "Tracking & analytics",
    description: "See opens, views, comments, and conversion from send to signature to payment.",
  },
];

const solutionItems: MegaItem[] = [
  {
    href: "/templates/proposals",
    title: "Sales teams",
    description: "Proposals, quotes, and MSAs that move deals from discovery to signature.",
  },
  {
    href: "/templates/agreements",
    title: "Legal & ops",
    description: "NDAs, DPAs, and vendor agreements with audit-ready signing.",
  },
  {
    href: "/templates/hr",
    title: "HR & people",
    description: "Offer letters, employment contracts, and acknowledgment workflows.",
  },
  {
    href: "/templates/sales",
    title: "Finance & commercial",
    description: "Invoices, POs, SOWs, and order forms connected to acceptance.",
  },
];

const resourceItems: MegaItem[] = [
  { href: "/blog", title: "Blog", description: "Product updates and document workflow playbooks." },
  { href: "/security", title: "Security", description: "How SendDox protects agreements and audit trails." },
  { href: "/contact", title: "Contact", description: "Talk with us about rollout and workflows." },
  { href: "/pricing", title: "Pricing", description: "Plans for growing sales and operations teams." },
];

function MegaPanel({
  id,
  open,
  columns,
  children,
}: {
  id: string;
  open: boolean;
  columns?: 2 | 3;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }
  return (
    <div
      id={id}
      role="menu"
      className={cn(
        "absolute left-1/2 top-full z-50 mt-2 w-[min(92vw,52rem)] -translate-x-1/2 rounded-2xl border border-[#d7dee8] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)]",
        columns === 3 ? "md:w-[min(92vw,64rem)]" : null,
      )}
    >
      <div className={cn("grid gap-2", columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>
    </div>
  );
}

function MegaLink({ href, title, description, onNavigate }: MegaItem & { onNavigate: () => void }) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="rounded-xl p-3 text-left transition-colors hover:bg-[#f3f6fa]"
    >
      <p className="text-sm font-semibold text-[#0f2744]">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#5b6b7c]">{description}</p>
    </Link>
  );
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const visible = useMarketingChromeVisible();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<"platform" | "solutions" | "templates" | "resources" | null>(
    null,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const platformId = useId();
  const solutionsId = useId();
  const templatesId = useId();
  const resourcesId = useId();

  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!visible) {
    return null;
  }

  function toggle(menu: typeof openMenu) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#e2e8f0] bg-[#f7f8fa]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="SendDox home"
          className="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f]/30"
        >
          <SendDoxLogo className="h-5 text-[#1e3a5f] sm:h-[22px]" title="" />
        </Link>

        <nav ref={navRef} aria-label="Primary navigation" className="relative hidden items-center gap-1 lg:flex">
          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-[#5b6b7c] hover:bg-white hover:text-[#0f2744]",
              openMenu === "platform" && "bg-white text-[#0f2744]",
            )}
            aria-expanded={openMenu === "platform"}
            aria-controls={platformId}
            onClick={() => toggle("platform")}
          >
            Platform
          </button>
          <MegaPanel id={platformId} open={openMenu === "platform"} columns={3}>
            {platformItems.map((item) => (
              <MegaLink key={item.href} {...item} onNavigate={() => setOpenMenu(null)} />
            ))}
          </MegaPanel>

          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-[#5b6b7c] hover:bg-white hover:text-[#0f2744]",
              openMenu === "solutions" && "bg-white text-[#0f2744]",
            )}
            aria-expanded={openMenu === "solutions"}
            aria-controls={solutionsId}
            onClick={() => toggle("solutions")}
          >
            Solutions
          </button>
          <MegaPanel id={solutionsId} open={openMenu === "solutions"}>
            {solutionItems.map((item) => (
              <MegaLink key={item.href} {...item} onNavigate={() => setOpenMenu(null)} />
            ))}
          </MegaPanel>

          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-[#5b6b7c] hover:bg-white hover:text-[#0f2744]",
              openMenu === "templates" && "bg-white text-[#0f2744]",
            )}
            aria-expanded={openMenu === "templates"}
            aria-controls={templatesId}
            onClick={() => toggle("templates")}
          >
            Document Templates
          </button>
          <MegaPanel id={templatesId} open={openMenu === "templates"} columns={3}>
            <Link
              href="/templates"
              role="menuitem"
              onClick={() => setOpenMenu(null)}
              className="rounded-xl bg-[#0f2744] p-3 text-white sm:col-span-3"
            >
              <p className="text-sm font-semibold">Free template library</p>
              <p className="mt-1 text-xs text-white/75">
                SEO-ready hubs for agreements, contracts, proposals, sales docs, HR, and operations.
              </p>
            </Link>
            {MARKETING_TEMPLATE_CATEGORIES.map((category) => (
              <MegaLink
                key={category.slug}
                href={`/templates/${category.slug}`}
                title={category.name}
                description={category.description}
                onNavigate={() => setOpenMenu(null)}
              />
            ))}
          </MegaPanel>

          <Link href="/pricing" className="rounded-md px-3 py-2 text-sm font-medium text-[#5b6b7c] hover:text-[#0f2744]">
            Pricing
          </Link>

          <button
            type="button"
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-[#5b6b7c] hover:bg-white hover:text-[#0f2744]",
              openMenu === "resources" && "bg-white text-[#0f2744]",
            )}
            aria-expanded={openMenu === "resources"}
            aria-controls={resourcesId}
            onClick={() => toggle("resources")}
          >
            Resources
          </button>
          <MegaPanel id={resourcesId} open={openMenu === "resources"}>
            {resourceItems.map((item) => (
              <MegaLink key={item.href} {...item} onNavigate={() => setOpenMenu(null)} />
            ))}
          </MegaPanel>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/product#workflow"
            className="hidden text-sm font-medium text-[#5b6b7c] hover:text-[#0f2744] md:inline"
          >
            See how it works
          </Link>
          {signedIn ? (
            <Link
              href="/app"
              className="rounded-lg bg-[#1e3a5f] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#18324f]"
            >
              Open app
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#5b6b7c] hover:text-[#0f2744] sm:inline"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-[#1e3a5f] px-3.5 py-2 text-sm font-medium text-white hover:bg-[#18324f]"
              >
                Start free
              </Link>
            </>
          )}
          <button
            type="button"
            className="rounded-md p-2 text-[#5b6b7c] hover:bg-white lg:hidden"
            aria-expanded={mobileOpen}
            aria-label="Open menu"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-[#e2e8f0] bg-white px-4 py-4 lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 text-sm">
            <Link href="/product" onClick={() => setMobileOpen(false)} className="font-medium text-[#0f2744]">
              Platform
            </Link>
            <Link href="/templates" onClick={() => setMobileOpen(false)} className="font-medium text-[#0f2744]">
              Document Templates
            </Link>
            {MARKETING_TEMPLATE_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                href={`/templates/${category.slug}`}
                onClick={() => setMobileOpen(false)}
                className="pl-3 text-[#5b6b7c]"
              >
                {category.navLabel}
              </Link>
            ))}
            <Link href="/pricing" onClick={() => setMobileOpen(false)} className="font-medium text-[#0f2744]">
              Pricing
            </Link>
            <Link href="/security" onClick={() => setMobileOpen(false)} className="font-medium text-[#0f2744]">
              Security
            </Link>
            <Link href="/blog" onClick={() => setMobileOpen(false)} className="font-medium text-[#0f2744]">
              Blog
            </Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)} className="font-medium text-[#0f2744]">
              Contact
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

export function SiteFooter() {
  const visible = useMarketingChromeVisible();
  if (!visible) {
    return null;
  }

  return (
    <footer className="border-t border-[#e2e8f0] bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_repeat(3,1fr)]">
        <div>
          <SendDoxLogo className="h-5 text-[#1e3a5f]" title="" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#5b6b7c]">
            Create documents, coordinate your team, engage prospects, and know exactly what happens next—from first
            hello to signed deal.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">Product</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[#5b6b7c]">
            <Link href="/product" className="hover:text-[#0f2744]">
              Platform
            </Link>
            <Link href="/pricing" className="hover:text-[#0f2744]">
              Pricing
            </Link>
            <Link href="/security" className="hover:text-[#0f2744]">
              Security
            </Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">Templates</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[#5b6b7c]">
            {MARKETING_TEMPLATE_CATEGORIES.slice(0, 5).map((category) => (
              <Link key={category.slug} href={`/templates/${category.slug}`} className="hover:text-[#0f2744]">
                {category.navLabel}
              </Link>
            ))}
            <Link href="/templates" className="font-medium text-[#1e3a5f] hover:underline">
              View all
            </Link>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94a3b8]">Company</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-[#5b6b7c]">
            <Link href="/blog" className="hover:text-[#0f2744]">
              Blog
            </Link>
            <Link href="/contact" className="hover:text-[#0f2744]">
              Contact
            </Link>
            <Link href="/signup" className="hover:text-[#0f2744]">
              Start free
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[#e2e8f0]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-[#94a3b8] sm:px-6">
          <p>© {new Date().getFullYear()} SendDox. Document automation for modern teams.</p>
          <p>Templates are provided for business use; review with counsel for your jurisdiction.</p>
        </div>
      </div>
    </footer>
  );
}
