-- AlterTable
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "is_sample" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Template" ADD COLUMN IF NOT EXISTS "sample_folder_slug" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Template_is_sample_sample_folder_slug_idx" ON "Template"("is_sample", "sample_folder_slug");
