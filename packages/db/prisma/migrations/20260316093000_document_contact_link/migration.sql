-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "contact_id" TEXT;

-- CreateIndex
CREATE INDEX "Document_contact_id_idx" ON "Document"("contact_id");

-- AddForeignKey
ALTER TABLE "Document"
ADD CONSTRAINT "Document_contact_id_fkey"
FOREIGN KEY ("contact_id")
REFERENCES "Contact"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
