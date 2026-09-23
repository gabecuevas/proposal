import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/editor/template-editor";
import { FlowDocumentEditor } from "@/components/flow-document/flow-document-editor";
import { CommercialDocumentEditor } from "@/components/commercial/commercial-document-editor";
import { listContentBlocks } from "@/lib/editor/content-block-store";
import {
  getSampleTemplate,
  getTemplate,
  templateUsesCommercialEditor,
  templateUsesFlowEditor,
} from "@/lib/editor/template-store";
import { getServerSession } from "@/lib/auth/server-session";
import { unwrapTextBoxesInEditorDoc } from "@/lib/flow-document/normalize-content";
import { ensureCommercialDocument } from "@/lib/commercial/parse";
import { isCommercialDocument } from "@/lib/commercial/schema";
import { defaultPricingModel } from "@/lib/editor/defaults";
import type { PricingModel } from "@/lib/editor/types";

type Params = {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ preview?: string; folder?: string }>;
};
export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({ params, searchParams }: Params) {
  const session = await getServerSession();
  const workspaceId = session?.workspaceId;
  if (!workspaceId) {
    notFound();
  }

  const { templateId } = await params;
  const query = await searchParams;
  const previewRequested = query.preview === "1";
  const sampleFolder = typeof query.folder === "string" ? query.folder.trim() : "";

  const [workspaceTemplate, contentBlocks] = await Promise.all([
    getTemplate(templateId, workspaceId),
    listContentBlocks(workspaceId),
  ]);
  const sampleTemplate =
    workspaceTemplate && !workspaceTemplate.is_sample ? null : await getSampleTemplate(templateId);
  const template = workspaceTemplate ?? sampleTemplate;
  if (!template) {
    notFound();
  }

  const masterPreview = previewRequested && Boolean(template.is_sample);
  const closeHref = masterPreview
    ? sampleFolder
      ? `/app/templates?samples=1&folder=${encodeURIComponent(sampleFolder)}`
      : "/app/templates?samples=1"
    : "/app/templates";

  if (templateUsesCommercialEditor(template)) {
    const tags = (template.tags ?? []).map((tag) => String(tag).toLowerCase());
    const type =
      tags.includes("invoice") ||
      (isCommercialDocument(template.pricing_json) && template.pricing_json.type === "invoice")
        ? "invoice"
        : "quote";
    const commercial = ensureCommercialDocument(template.pricing_json, type);
    return (
      <CommercialDocumentEditor
        templateId={template.id}
        type={commercial.type}
        initialName={template.name}
        initialCommercial={commercial}
        closeHref={closeHref}
        masterPreview={masterPreview}
      />
    );
  }

  if (templateUsesFlowEditor(template)) {
    return (
      <FlowDocumentEditor
        templateId={template.id}
        initialName={template.name}
        initialDoc={unwrapTextBoxesInEditorDoc(template.editor_json)}
        closeHref={closeHref}
        masterPreview={masterPreview}
      />
    );
  }

  return (
    <TemplateEditor
      templateId={template.id}
      initialName={template.name}
      initialDoc={template.editor_json}
      initialVariableRegistry={template.variable_registry}
      initialPricing={
        template.pricing_json &&
        typeof template.pricing_json === "object" &&
        Array.isArray((template.pricing_json as PricingModel).items)
          ? (template.pricing_json as PricingModel)
          : defaultPricingModel
      }
      contentBlocks={contentBlocks}
      masterPreview={masterPreview}
      closeHref={closeHref}
    />
  );
}
