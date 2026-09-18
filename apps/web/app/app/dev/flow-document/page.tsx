import { notFound } from "next/navigation";
import { FlowDocumentPrototype } from "@/components/flow-document/flow-document-prototype";
import { isFlowDocumentPrototypeEnabled } from "@/lib/flow-document/access";

export const dynamic = "force-dynamic";

/**
 * Dev-only Flow Document Phase 1A surface.
 * Unavailable when NODE_ENV=production unless ALLOW_FLOW_DOCUMENT_PROTOTYPE=1.
 */
export default function FlowDocumentPrototypePage() {
  if (!isFlowDocumentPrototypeEnabled()) {
    notFound();
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-3 p-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Flow Document lab</h1>
        <p className="text-sm text-muted">
          Isolated continuous editor for pagination feasibility. Not linked from production
          navigation.
        </p>
      </div>
      <FlowDocumentPrototype />
    </div>
  );
}
