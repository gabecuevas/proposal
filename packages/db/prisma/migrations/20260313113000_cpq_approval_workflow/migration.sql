-- Workspace-level CPQ approval policy.
ALTER TABLE "Workspace"
ADD COLUMN "cpq_approval_discount_threshold" INTEGER NOT NULL DEFAULT 15;

-- Quote approval workflow records.
CREATE TYPE "QuoteApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "QuoteApprovalRequest" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "status" "QuoteApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_user_id" TEXT NOT NULL,
  "requested_reason" TEXT,
  "decided_by_user_id" TEXT,
  "decided_reason" TEXT,
  "discount_percent" DOUBLE PRECISION NOT NULL,
  "threshold_percent" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  CONSTRAINT "QuoteApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteApprovalRequest_workspace_id_created_at_idx"
ON "QuoteApprovalRequest"("workspace_id", "created_at");

CREATE INDEX "QuoteApprovalRequest_document_id_created_at_idx"
ON "QuoteApprovalRequest"("document_id", "created_at");

ALTER TABLE "QuoteApprovalRequest"
ADD CONSTRAINT "QuoteApprovalRequest_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteApprovalRequest"
ADD CONSTRAINT "QuoteApprovalRequest_document_id_fkey"
FOREIGN KEY ("document_id") REFERENCES "Document"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
