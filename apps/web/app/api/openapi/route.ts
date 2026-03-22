import { NextResponse } from "next/server";

export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Proposal API",
      version: "0.1.0",
      description: "Core APIs for templates, documents, signing sessions, artifacts, API keys, and webhooks.",
    },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "proposal_session",
        },
        bearerApiKey: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
    paths: {
      "/api/auth/signup": { post: { summary: "Create account and workspace" } },
      "/api/auth/login": { post: { summary: "Authenticate user session" } },
      "/api/auth/logout": { post: { summary: "Clear current session" } },
      "/api/auth/google/start": { get: { summary: "Start Google OAuth sign-in flow" } },
      "/api/auth/google/callback": { get: { summary: "Complete Google OAuth sign-in flow" } },
      "/api/ai/generate": { post: { summary: "Generate AI content using document/template structured context" } },
      "/api/health": { get: { summary: "Liveness probe" } },
      "/api/ready": { get: { summary: "Readiness probe with dependencies" } },
      "/api/dashboard/summary": { get: { summary: "Workspace dashboard summary counts and recent activity" } },
      "/api/templates": { get: { summary: "List templates" }, post: { summary: "Create template" } },
      "/api/templates/{templateId}": { get: { summary: "Get template" }, patch: { summary: "Update template" } },
      "/api/documents/from-template": { post: { summary: "Create document from template" } },
      "/api/documents": { get: { summary: "List documents" }, post: { summary: "Create blank or templated document" } },
      "/api/contacts": { get: { summary: "List contacts" }, post: { summary: "Create contact" } },
      "/api/contacts/{contactId}": { patch: { summary: "Update contact" } },
      "/api/documents/{documentId}": { get: { summary: "Get document" }, patch: { summary: "Update document draft" } },
      "/api/documents/{documentId}/send": { post: { summary: "Send document" } },
      "/api/documents/{documentId}/approval": {
        get: { summary: "Get quote approval summary for a document" },
        post: { summary: "Request quote approval for high-discount deal" },
      },
      "/api/documents/{documentId}/approval/decision": {
        post: { summary: "Approve or reject pending quote approval request" },
      },
      "/api/documents/{documentId}/render": { get: { summary: "Render computed document HTML" } },
      "/api/documents/{documentId}/finalize": { post: { summary: "Finalize document and enqueue PDF job" } },
      "/api/documents/{documentId}/signing-session": { post: { summary: "Mint recipient signing token" } },
      "/api/documents/{documentId}/signer-fields": { get: { summary: "List signer fields" } },
      "/api/documents/{documentId}/signer-fields/{fieldId}": { patch: { summary: "Set signer field value" } },
      "/api/documents/{documentId}/activity": { get: { summary: "List activity feed events" } },
      "/api/documents/{documentId}/artifact-url": { post: { summary: "Create signed finalized PDF URL" } },
      "/api/documents/{documentId}/artifact": { get: { summary: "Download finalized PDF by token" } },
      "/api/documents/{documentId}/checkout-session": { post: { summary: "Create Stripe checkout session for document payment" } },
      "/api/documents/{documentId}/payments": { get: { summary: "List document payment attempts and outcomes" } },
      "/api/analytics/overview": { get: { summary: "Workspace analytics overview metrics" } },
      "/api/analytics/documents/{documentId}": { get: { summary: "Per-document analytics timeline and webhook stats" } },
      "/api/workspace/api-keys": { get: { summary: "List API keys" }, post: { summary: "Create API key" } },
      "/api/workspace/api-keys/analytics": { get: { summary: "Get API key lifecycle analytics" } },
      "/api/workspace/api-keys/{apiKeyId}/revoke": { post: { summary: "Revoke API key" } },
      "/api/workspace/api-keys/{apiKeyId}/rotate": { post: { summary: "Rotate API key and return replacement secret" } },
      "/api/workspace/compliance/policy": { get: { summary: "Get workspace compliance policy" }, patch: { summary: "Update workspace compliance policy" } },
      "/api/workspace/webhooks": { get: { summary: "List webhook endpoints" }, post: { summary: "Create webhook endpoint" } },
      "/api/workspace/webhooks/{endpointId}": { patch: { summary: "Update webhook endpoint" } },
      "/api/workspace/webhooks/deliveries/{deliveryId}/replay": {
        post: { summary: "Replay a webhook delivery manually" },
      },
      "/api/audit/activity": { get: { summary: "Search and filter document activity events" } },
      "/api/audit/checksum": { get: { summary: "Verify forensic checksum for audit slices" } },
      "/api/audit/evidence-bundle": { get: { summary: "Download signed audit evidence bundle" } },
      "/api/audit/export-token": { post: { summary: "Create a signed audit export token" } },
      "/api/audit/webhook-deliveries": { get: { summary: "Search and filter webhook deliveries" } },
      "/api/audit/export": { get: { summary: "Export audit records as NDJSON" } },
      "/api/audit/retention": { post: { summary: "Run audit retention cleanup (dry run or delete)" } },
      "/api/stripe/webhook": { post: { summary: "Receive Stripe webhook events" } },
    },
  };

  return NextResponse.json(spec);
}
