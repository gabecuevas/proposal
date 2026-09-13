export type SampleTemplateFolder = {
  slug: string;
  name: string;
  description: string;
};

/**
 * Master template categories shown under Library → Sample Templates.
 * Platform owners publish templates into these folders; users copy them into My Library.
 */
export const SAMPLE_TEMPLATE_FOLDERS: readonly SampleTemplateFolder[] = [
  {
    slug: "legal-agreements-nda",
    name: "Legal Agreements & NDA Templates",
    description: "NDAs, MSAs, and other legal agreements ready to customize.",
  },
  {
    slug: "contracts",
    name: "Contracts",
    description: "Service, vendor, and client contract templates.",
  },
  {
    slug: "proposal-templates",
    name: "Proposal Templates",
    description: "Sales proposals and statements of work.",
  },
  {
    slug: "billing-commercial",
    name: "Billing & Commercial Templates",
    description: "Quotes, invoices, and commercial terms.",
  },
  {
    slug: "hr-employment",
    name: "HR & Employment Templates",
    description: "Offer letters, policies, and employment paperwork.",
  },
  {
    slug: "business-operations",
    name: "Business Operations",
    description: "SOPs, checklists, and day-to-day operations docs.",
  },
  {
    slug: "procurement-corporate",
    name: "Procurement & Corporate Templates",
    description: "Purchase orders, corporate forms, and procurement packets.",
  },
] as const;

export function sampleFolderBySlug(slug: string | null | undefined): SampleTemplateFolder | null {
  if (!slug) {
    return null;
  }
  return SAMPLE_TEMPLATE_FOLDERS.find((folder) => folder.slug === slug) ?? null;
}

export function isSampleFolderSlug(slug: string): boolean {
  return SAMPLE_TEMPLATE_FOLDERS.some((folder) => folder.slug === slug);
}
