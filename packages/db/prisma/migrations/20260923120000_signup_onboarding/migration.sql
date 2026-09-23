-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- AlterTable Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "brand_color" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "legal_name" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "no_website" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "business_email" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "business_phone" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "company_size" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'America/Los_Angeles';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'USD';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "locale" TEXT DEFAULT 'en-US';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "quote_validity_days" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "invoice_payment_term_days" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "company_setup_completed_at" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "sample_mode_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"("slug");

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pending_email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verification_generation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisional_company_name" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar_asset_key" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "personal_timezone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "terms_version" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacy_version" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "google_sub" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_google_sub_key" ON "User"("google_sub");

-- Legacy users with a workspace membership are treated as verified.
UPDATE "User" u
SET "email_verified_at" = COALESCE(u."email_verified_at", u."created_at")
WHERE EXISTS (
  SELECT 1 FROM "WorkspaceMember" m WHERE m."user_id" = u."id"
) AND u."email_verified_at" IS NULL;

-- Mark existing workspaces as company-setup complete.
UPDATE "Workspace"
SET "company_setup_completed_at" = COALESCE("company_setup_completed_at", "createdAt")
WHERE "company_setup_completed_at" IS NULL;

-- AlterTable WorkspaceInvite
ALTER TABLE "WorkspaceInvite" ALTER COLUMN "invite_token" DROP NOT NULL;
ALTER TABLE "WorkspaceInvite" ADD COLUMN IF NOT EXISTS "invite_token_hash" TEXT;
ALTER TABLE "WorkspaceInvite" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3);
ALTER TABLE "WorkspaceInvite" ADD COLUMN IF NOT EXISTS "delivery_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "WorkspaceInvite" ADD COLUMN IF NOT EXISTS "delivery_error" TEXT;
ALTER TABLE "WorkspaceInvite" ADD COLUMN IF NOT EXISTS "last_sent_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_invite_token_hash_key" ON "WorkspaceInvite"("invite_token_hash");
CREATE INDEX IF NOT EXISTS "WorkspaceInvite_workspace_id_email_idx" ON "WorkspaceInvite"("workspace_id", "email");
CREATE INDEX IF NOT EXISTS "WorkspaceInvite_workspace_id_revoked_at_accepted_at_idx" ON "WorkspaceInvite"("workspace_id", "revoked_at", "accepted_at");

-- CreateTable AuthToken
CREATE TABLE IF NOT EXISTS "AuthToken" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "pending_email" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuthToken_token_hash_key" ON "AuthToken"("token_hash");
CREATE INDEX IF NOT EXISTS "AuthToken_user_id_purpose_created_at_idx" ON "AuthToken"("user_id", "purpose", "created_at");
CREATE INDEX IF NOT EXISTS "AuthToken_expires_at_idx" ON "AuthToken"("expires_at");

ALTER TABLE "AuthToken" DROP CONSTRAINT IF EXISTS "AuthToken_user_id_fkey";
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable UserWorkspaceOnboarding
CREATE TABLE IF NOT EXISTS "UserWorkspaceOnboarding" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "team_step_completed_at" TIMESTAMP(3),
    "team_step_skipped_at" TIMESTAMP(3),
    "tour_dismissed_at" TIMESTAMP(3),
    "tour_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserWorkspaceOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserWorkspaceOnboarding_user_id_workspace_id_key" ON "UserWorkspaceOnboarding"("user_id", "workspace_id");

ALTER TABLE "UserWorkspaceOnboarding" DROP CONSTRAINT IF EXISTS "UserWorkspaceOnboarding_user_id_fkey";
ALTER TABLE "UserWorkspaceOnboarding" ADD CONSTRAINT "UserWorkspaceOnboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWorkspaceOnboarding" DROP CONSTRAINT IF EXISTS "UserWorkspaceOnboarding_workspace_id_fkey";
ALTER TABLE "UserWorkspaceOnboarding" ADD CONSTRAINT "UserWorkspaceOnboarding_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable MailOutbox
CREATE TABLE IF NOT EXISTS "MailOutbox" (
    "id" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html_body" TEXT NOT NULL,
    "text_body" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sensitive_payload" TEXT,
    "related_token_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MailOutbox_idempotency_key_key" ON "MailOutbox"("idempotency_key");
CREATE INDEX IF NOT EXISTS "MailOutbox_status_scheduled_at_idx" ON "MailOutbox"("status", "scheduled_at");

-- CreateTable AuditEvent
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditEvent_workspace_id_created_at_idx" ON "AuditEvent"("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "AuditEvent_actor_user_id_created_at_idx" ON "AuditEvent"("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "AuditEvent_action_created_at_idx" ON "AuditEvent"("action", "created_at");
