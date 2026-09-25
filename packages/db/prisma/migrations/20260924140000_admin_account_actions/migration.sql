-- Additive: admin account actions (disable, archive, billing freeze, sudo sessions).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabled_at" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "disabled_reason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "billing_frozen_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SupportImpersonationSession" (
    "id" TEXT NOT NULL,
    "admin_user_id" TEXT NOT NULL,
    "admin_email" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "target_email" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "ended_reason" TEXT,
    "request_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SupportImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportImpersonationSession_admin_user_id_started_at_idx"
    ON "SupportImpersonationSession"("admin_user_id", "started_at");
CREATE INDEX IF NOT EXISTS "SupportImpersonationSession_target_user_id_started_at_idx"
    ON "SupportImpersonationSession"("target_user_id", "started_at");
