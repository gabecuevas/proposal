-- Add optional API key expiry and index for active-key lookups.
ALTER TABLE "ApiKey"
ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE INDEX "ApiKey_workspace_id_revoked_at_expires_at_idx"
ON "ApiKey"("workspace_id", "revoked_at", "expires_at");
