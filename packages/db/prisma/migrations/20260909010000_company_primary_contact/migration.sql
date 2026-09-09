-- AlterTable
ALTER TABLE "Company" ADD COLUMN "primary_contact_id" TEXT;

-- CreateIndex
CREATE INDEX "Company_workspace_id_primary_contact_id_idx" ON "Company"("workspace_id", "primary_contact_id");
