-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "notes" TEXT,
    "tags" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT,
    "value_minor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "person_id" TEXT,
    "company_id" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "company_id" TEXT;

-- CreateIndex
CREATE INDEX "Company_workspace_id_updated_at_idx" ON "Company"("workspace_id", "updated_at");
CREATE INDEX "Company_workspace_id_name_idx" ON "Company"("workspace_id", "name");
CREATE INDEX "Lead_workspace_id_updated_at_idx" ON "Lead"("workspace_id", "updated_at");
CREATE INDEX "Lead_workspace_id_status_idx" ON "Lead"("workspace_id", "status");
CREATE INDEX "Contact_workspace_id_company_id_idx" ON "Contact"("workspace_id", "company_id");

-- AddForeignKey
ALTER TABLE "Company"
ADD CONSTRAINT "Company_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Company"
ADD CONSTRAINT "Company_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_person_id_fkey"
FOREIGN KEY ("person_id") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
