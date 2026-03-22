-- Add workspace-level compliance policy controls.
ALTER TABLE "Workspace"
ADD COLUMN "audit_retention_days" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN "audit_export_token_ttl_minutes" INTEGER NOT NULL DEFAULT 15;
