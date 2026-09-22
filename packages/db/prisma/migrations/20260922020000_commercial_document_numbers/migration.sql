-- Commercial quote/invoice document number sequences (workspace-scoped).
CREATE TABLE "DocumentNumberSequence" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "next_number" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentNumberSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentNumberSequence_workspace_id_kind_key"
ON "DocumentNumberSequence"("workspace_id", "kind");

ALTER TABLE "DocumentNumberSequence"
ADD CONSTRAINT "DocumentNumberSequence_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Issued numbers for uniqueness (editable numbers validated against this table).
CREATE TABLE "DocumentIssuedNumber" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "document_number" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentIssuedNumber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentIssuedNumber_workspace_id_kind_document_number_key"
ON "DocumentIssuedNumber"("workspace_id", "kind", "document_number");

CREATE UNIQUE INDEX "DocumentIssuedNumber_document_id_key"
ON "DocumentIssuedNumber"("document_id");

ALTER TABLE "DocumentIssuedNumber"
ADD CONSTRAINT "DocumentIssuedNumber_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentIssuedNumber"
ADD CONSTRAINT "DocumentIssuedNumber_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "Document"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "PaymentProvider" ADD VALUE 'MANUAL';
