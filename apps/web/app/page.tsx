import type { Metadata } from "next";
import { MarketingHomePage } from "@/components/marketing/marketing-home";

export const metadata: Metadata = {
  title: "SendDox | Move Every Deal Forward",
  description:
    "Create documents, coordinate your team, engage prospects, and know exactly what happens next—from lead to signature to payment.",
  openGraph: {
    title: "SendDox | Move Every Deal Forward",
    description:
      "Document automation for modern teams: templates, approvals, eSignature, tracking, and payments in one workspace.",
    type: "website",
  },
};

export default function Home() {
  return <MarketingHomePage />;
}
