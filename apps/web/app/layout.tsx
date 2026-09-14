import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/site-chrome/site-chrome";
import { getServerSession } from "@/lib/auth/server-session";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.senddox.com"),
  title: {
    default: "SendDox | Move Every Deal Forward",
    template: "%s | SendDox",
  },
  description:
    "Create documents, coordinate your team, engage prospects, and know exactly what happens next—from proposal to e-signature to payment.",
  openGraph: {
    title: "SendDox | Move Every Deal Forward",
    description:
      "Document automation for modern teams: free templates, approvals, eSignature, tracking, and payments.",
    type: "website",
    siteName: "SendDox",
  },
  twitter: {
    card: "summary_large_image",
    title: "SendDox | Move Every Deal Forward",
    description: "Templates, CRM context, eSignature, and payments in one sales workspace.",
  },
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
