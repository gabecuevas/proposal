-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmEmailSignature" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "account_id" TEXT,
    "name" TEXT NOT NULL,
    "body_html" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmEmailSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmEmailSignature_workspace_id_updated_at_idx" ON "CrmEmailSignature"("workspace_id", "updated_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmEmailSignature_account_id_updated_at_idx" ON "CrmEmailSignature"("account_id", "updated_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmEmailSignature" ADD CONSTRAINT "CrmEmailSignature_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmEmailSignature" ADD CONSTRAINT "CrmEmailSignature_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmEmailSignature" ADD CONSTRAINT "CrmEmailSignature_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "CrmEmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
