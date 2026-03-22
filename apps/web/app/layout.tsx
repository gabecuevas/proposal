import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "@/lib/auth/server-session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DoxySign | Document Automation Platform",
    template: "%s | DoxySign",
  },
  description:
    "Production-grade document automation platform for proposals, approvals, eSignature, payments, and analytics.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession();
  const links = [
    { href: "/", label: "Home" },
    { href: "/product", label: "Product" },
    { href: "/pricing", label: "Pricing" },
    { href: "/security", label: "Security" },
    { href: "/templates", label: "Templates" },
    { href: "/blog", label: "Blog" },
    { href: "/contact", label: "Contact" },
    { href: "/login", label: "Login" },
    { href: "/signup", label: "Signup" },
  ];

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-white/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight text-[#28206f]">
              DoxySign
            </Link>
            <nav className="hidden flex-wrap items-center gap-4 text-sm text-muted md:flex">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              {session ? (
                <Link
                  href="/app"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Open App
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="rounded-lg border border-border bg-white px-3 py-2 text-sm hover:bg-surface"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        {children}
        <footer className="border-t border-border/70 bg-white/70">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted">
            <p>2026 DoxySign. Document automation for modern teams.</p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/security" className="hover:text-foreground">
                Security
              </Link>
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
