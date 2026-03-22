-- Webhook endpoint trust policy fields.
ALTER TABLE "WebhookEndpoint"
ADD COLUMN "allowed_ips_json" JSONB,
ADD COLUMN "require_mtls" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mtls_cert_fingerprint" TEXT;

-- Immutable audit export ledger with per-workspace hash chain.
CREATE TABLE "AuditExportLedger" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "export_type" TEXT NOT NULL,
  "before_at" TIMESTAMP(3),
  "export_limit" INTEGER NOT NULL,
  "row_count" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "previous_entry_hash" TEXT,
  "entry_hash" TEXT NOT NULL,
  "metadata_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditExportLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditExportLedger_workspace_id_created_at_idx"
ON "AuditExportLedger"("workspace_id", "created_at");

ALTER TABLE "AuditExportLedger"
ADD CONSTRAINT "AuditExportLedger_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
