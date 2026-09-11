-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmEmailTemplateVisibility" AS ENUM ('PRIVATE', 'SHARED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmEmailTemplate" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body_html" TEXT NOT NULL DEFAULT '',
    "visibility" "CrmEmailTemplateVisibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmEmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmEmailTemplate_workspace_id_updated_at_idx" ON "CrmEmailTemplate"("workspace_id", "updated_at");
CREATE INDEX IF NOT EXISTS "CrmEmailTemplate_workspace_id_name_idx" ON "CrmEmailTemplate"("workspace_id", "name");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmEmailTemplate" ADD CONSTRAINT "CrmEmailTemplate_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmEmailTemplate" ADD CONSTRAINT "CrmEmailTemplate_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
