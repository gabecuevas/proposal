-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "phones" JSONB;
ALTER TABLE "Company" ADD COLUMN "phones" JSONB;
ALTER TABLE "Lead" ADD COLUMN "phones" JSONB;

-- Backfill legacy scalar phone into phones JSON (Work, primary)
UPDATE "Contact"
SET "phones" = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'number', "phone",
    'type', 'work',
    'primary', true
  )
)
WHERE "phone" IS NOT NULL AND btrim("phone") <> '' AND "phones" IS NULL;

UPDATE "Company"
SET "phones" = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'number', "phone",
    'type', 'work',
    'primary', true
  )
)
WHERE "phone" IS NOT NULL AND btrim("phone") <> '' AND "phones" IS NULL;

UPDATE "Lead"
SET "phones" = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'number', "phone",
    'type', 'work',
    'primary', true
  )
)
WHERE "phone" IS NOT NULL AND btrim("phone") <> '' AND "phones" IS NULL;
