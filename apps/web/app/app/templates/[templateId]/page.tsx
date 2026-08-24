import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/editor/template-editor";
import { listContentBlocks } from "@/lib/editor/content-block-store";
import { getTemplate } from "@/lib/editor/template-store";
import { getServerSession } from "@/lib/auth/server-session";

type Params = { params: Promise<{ templateId: string }> };
export const dynamic = "force-dynamic";

export default async function TemplateDetailPage({ params }: Params) {
  const session = await getServerSession();
  const workspaceId = session?.workspaceId;
  if (!workspaceId) {
    notFound();
  }

  const { templateId } = await params;
  const [template, contentBlocks] = await Promise.all([
    getTemplate(templateId, workspaceId),
    listContentBlocks(workspaceId),
  ]);
  if (!template) {
    notFound();
  }

  return (
    <TemplateEditor
      templateId={template.id}
      initialName={template.name}
      initialDoc={template.editor_json}
      initialVariableRegistry={template.variable_registry}
      initialPricing={template.pricing_json}
      contentBlocks={contentBlocks}
    />
  );
}
