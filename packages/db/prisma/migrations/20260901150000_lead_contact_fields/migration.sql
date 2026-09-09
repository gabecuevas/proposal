-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "first_name" TEXT;
ALTER TABLE "Lead" ADD COLUMN "last_name" TEXT;
ALTER TABLE "Lead" ADD COLUMN "full_name" TEXT;
ALTER TABLE "Lead" ADD COLUMN "company_name" TEXT;
ALTER TABLE "Lead" ADD COLUMN "contact_title" TEXT;
ALTER TABLE "Lead" ADD COLUMN "address_line_1" TEXT;
ALTER TABLE "Lead" ADD COLUMN "address_line_2" TEXT;
ALTER TABLE "Lead" ADD COLUMN "city" TEXT;
ALTER TABLE "Lead" ADD COLUMN "state" TEXT;
ALTER TABLE "Lead" ADD COLUMN "postal_code" TEXT;
ALTER TABLE "Lead" ADD COLUMN "country" TEXT;
ALTER TABLE "Lead" ADD COLUMN "website" TEXT;
ALTER TABLE "Lead" ADD COLUMN "custom_fields_json" JSONB;
ALTER TABLE "Lead" ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Lead" ADD COLUMN "color_label" TEXT;
ALTER TABLE "Lead" ADD COLUMN "last_activity_at" TIMESTAMP(3);
