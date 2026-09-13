import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/editor/template-editor";
import { listContentBlocks } from "@/lib/editor/content-block-store";
import { getSampleTemplate, getTemplate } from "@/lib/editor/template-store";
import { getServerSession } from "@/lib/auth/server-session";

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

  return (
    <TemplateEditor
      templateId={template.id}
      initialName={template.name}
      initialDoc={template.editor_json}
      initialVariableRegistry={template.variable_registry}
      initialPricing={template.pricing_json}
      contentBlocks={contentBlocks}
      masterPreview={masterPreview}
      closeHref={closeHref}
    />
  );
}
