import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome/site-chrome";
import { getServerSession } from "@/lib/auth/server-session";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SendDox | Document Automation Platform",
    template: "%s | SendDox",
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

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader signedIn={Boolean(session)} />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
