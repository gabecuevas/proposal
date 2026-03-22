-- Payment enums.
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');
CREATE TYPE "DocumentPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED', 'FAILED');

-- Stripe checkout sessions linked to documents.
CREATE TABLE "DocumentPayment" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "provider_session_id" TEXT NOT NULL,
  "status" "DocumentPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "checkout_url" TEXT,
  "paid_at" TIMESTAMP(3),
  "metadata_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentPayment_provider_session_id_key"
ON "DocumentPayment"("provider_session_id");

CREATE INDEX "DocumentPayment_workspace_id_status_created_at_idx"
ON "DocumentPayment"("workspace_id", "status", "created_at");

CREATE INDEX "DocumentPayment_document_id_created_at_idx"
ON "DocumentPayment"("document_id", "created_at");

ALTER TABLE "DocumentPayment"
ADD CONSTRAINT "DocumentPayment_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentPayment"
ADD CONSTRAINT "DocumentPayment_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "Document"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
