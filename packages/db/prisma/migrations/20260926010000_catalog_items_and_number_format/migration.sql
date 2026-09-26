-- Remember the quote/invoice number format (e.g. "SD-" + 4 digits) per workspace series.
ALTER TABLE "DocumentNumberSequence" ADD COLUMN "prefix" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DocumentNumberSequence" ADD COLUMN "suffix" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DocumentNumberSequence" ADD COLUMN "pad_width" INTEGER NOT NULL DEFAULT 0;

-- Catalog products and services used for quote/invoice line items.
CREATE TABLE "CatalogItem" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "unit_price_minor" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "created_by" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogItem_workspace_id_kind_idx" ON "CatalogItem"("workspace_id", "kind");

ALTER TABLE "CatalogItem"
ADD CONSTRAINT "CatalogItem_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
