import { notFound } from "next/navigation";
import Link from "next/link";
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
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Template Editor</h1>
        <Link
          href="/app/templates/new"
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface"
        >
          New template
        </Link>
      </div>
      <TemplateEditor
        templateId={template.id}
        initialName={template.name}
        initialDoc={template.editor_json}
        initialVariableRegistry={template.variable_registry}
        initialPricing={template.pricing_json}
        contentBlocks={contentBlocks}
      />
    </main>
  );
}
