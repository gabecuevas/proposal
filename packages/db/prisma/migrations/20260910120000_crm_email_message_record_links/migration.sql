-- AlterTable
ALTER TABLE "CrmEmailMessage" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrmEmailMessage_contact_id_message_at_idx" ON "CrmEmailMessage"("contact_id", "message_at");
CREATE INDEX IF NOT EXISTS "CrmEmailMessage_lead_id_message_at_idx" ON "CrmEmailMessage"("lead_id", "message_at");
CREATE INDEX IF NOT EXISTS "CrmEmailMessage_company_id_message_at_idx" ON "CrmEmailMessage"("company_id", "message_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmEmailMessage" ADD CONSTRAINT "CrmEmailMessage_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmEmailMessage" ADD CONSTRAINT "CrmEmailMessage_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmEmailMessage" ADD CONSTRAINT "CrmEmailMessage_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
