-- Additive: IP-derived location for platform contacts (city stays in "city" with city_source = 'ip').

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ip_region" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ip_country" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ip_timezone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "location_updated_at" TIMESTAMP(3);
