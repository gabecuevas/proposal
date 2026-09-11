-- AlterTable
ALTER TABLE "CrmEmailMessage" ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmEmailMessage_workspace_id_pinned_at_idx" ON "CrmEmailMessage"("workspace_id", "pinned_at");
