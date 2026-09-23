import { prisma, type InputJsonValue } from "@repo/db";
import { CURRENT_DOC_VERSION } from "@/lib/editor/types";
import { defaultEditorDoc } from "@/lib/editor/defaults";
import {
  createBlankCommercialDocument,
  type CommercialDocument,
} from "@/lib/commercial/schema";
import {
  ensureCommercialDocument,
  toCommercialTemplatePayload,
} from "@/lib/commercial/parse";

/** Stable tag so we only seed one platform Master Quote sample. */
export const MASTER_QUOTE_SAMPLE_TAG = "master-quote-v1";
export const MASTER_QUOTE_SAMPLE_NAME = "Master Quote";
export const MASTER_QUOTE_SAMPLE_FOLDER = "quotes";

/**
 * Local/dev source for the Master Quote layout (Library template the team designed).
 * When present, its commercial payload is cloned into the sample; otherwise defaults apply.
 */
export const MASTER_QUOTE_SOURCE_TEMPLATE_ID = "cmudx62ka005vgrpncr026iy2";

function buildDefaultMasterQuoteCommercial(): CommercialDocument {
  const commercial = toCommercialTemplatePayload(
    createBlankCommercialDocument("quote", { internalName: MASTER_QUOTE_SAMPLE_NAME }),
  );
  commercial.internalName = MASTER_QUOTE_SAMPLE_NAME;
  commercial.paymentTerms = "Due upon receipt";
  commercial.notes = "Here is the quote you requested. ";
  commercial.terms = "";
  commercial.logoAssetKey = null;
  commercial.theme = {
    tableHeaderBg: "#55677c",
    titleFontId: "arial",
    titleColor: "#526d8e",
    titleSizePx: 40,
  };
  commercial.sender = {
    text: "[Sender.FullName]\n[Sender.CompanyName]\n[Sender.FullAddress]\n[Sender.Phone]",
  };
  commercial.billTo = {
    text: "[Recipient.CompanyName]\n[Recipient.FullName]\n[Recipient.CompanyAddress]\n[Recipient.Phone]\n",
  };
  commercial.discount = { mode: "percent", enabled: true, valueScaled: 0 };
  commercial.tax = { mode: "percent", enabled: true, valueScaled: 0 };
  commercial.shipping = { mode: "percent", enabled: false, valueScaled: 0 };
  return commercial;
}

async function resolveMasterQuoteCommercial(): Promise<CommercialDocument> {
  const source = await prisma.template.findUnique({
    where: { id: MASTER_QUOTE_SOURCE_TEMPLATE_ID },
    select: { pricing_json: true },
  });
  if (source?.pricing_json) {
    const parsed = ensureCommercialDocument(source.pricing_json, "quote");
    const payload = toCommercialTemplatePayload(parsed);
    payload.internalName = MASTER_QUOTE_SAMPLE_NAME;
    // Sample masters should not lock onto a single workspace logo asset.
    payload.logoAssetKey = null;
    payload.sourceTemplateId = null;
    return payload;
  }
  return buildDefaultMasterQuoteCommercial();
}

/**
 * Ensures a commercial Master Quote exists in Sample Templates → Quotes.
 * Safe to call on every samples list; migrates/refreshes the tagged sample when present.
 */
export async function ensureMasterQuoteSampleTemplate(input: {
  workspaceId: string;
  actorUserId: string;
}): Promise<void> {
  const commercial = await resolveMasterQuoteCommercial();
  const existing = await prisma.template.findFirst({
    where: {
      is_sample: true,
      tags: { array_contains: [MASTER_QUOTE_SAMPLE_TAG] },
    },
    select: { id: true, sample_folder_slug: true, name: true },
  });

  const tags = [
    "commercial",
    "quote",
    "sample",
    `sample-folder:${MASTER_QUOTE_SAMPLE_FOLDER}`,
    MASTER_QUOTE_SAMPLE_TAG,
  ] as InputJsonValue;

  if (existing) {
    await prisma.template.update({
      where: { id: existing.id },
      data: {
        name: MASTER_QUOTE_SAMPLE_NAME,
        tags,
        pricing_json: commercial as unknown as InputJsonValue,
        sample_folder_slug: MASTER_QUOTE_SAMPLE_FOLDER,
        folder_id: null,
        is_sample: true,
        updated_by: input.actorUserId,
      },
    });
    return;
  }

  await prisma.template.create({
    data: {
      workspace_id: input.workspaceId,
      name: MASTER_QUOTE_SAMPLE_NAME,
      tags,
      variable_registry_json: {} as InputJsonValue,
      pricing_json: commercial as unknown as InputJsonValue,
      editor_json: defaultEditorDoc as InputJsonValue,
      schema_version: CURRENT_DOC_VERSION,
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
      folder_id: null,
      is_sample: true,
      sample_folder_slug: MASTER_QUOTE_SAMPLE_FOLDER,
    },
  });
}
