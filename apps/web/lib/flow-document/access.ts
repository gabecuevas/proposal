/**
 * Dev-only gate for the Flow Document Phase 1A prototype.
 * Production builds return false so the route can call notFound().
 */
export function isFlowDocumentPrototypeEnabled(): boolean {
  if (process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE === "1") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}
