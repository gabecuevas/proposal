-- AlterTable
ALTER TABLE "CrmEmailAccount" ADD COLUMN "oauth_access_token" TEXT,
ADD COLUMN "oauth_refresh_token" TEXT,
ADD COLUMN "oauth_expires_at" TIMESTAMP(3),
ADD COLUMN "oauth_scope" TEXT;
