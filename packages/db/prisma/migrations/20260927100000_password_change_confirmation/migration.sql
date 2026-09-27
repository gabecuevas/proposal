-- Signed-in password changes are held until the emailed confirmation link is used.
ALTER TYPE "AuthTokenPurpose" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGE';

ALTER TABLE "AuthToken" ADD COLUMN IF NOT EXISTS "pending_password_hash" TEXT;
