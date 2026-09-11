-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CrmCalendarSyncProvider" AS ENUM ('GOOGLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrmCalendarSyncStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmCalendarAccount" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "CrmCalendarSyncProvider" NOT NULL DEFAULT 'GOOGLE',
    "email" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "calendar_name" TEXT,
    "sync_status" "CrmCalendarSyncStatus" NOT NULL DEFAULT 'INACTIVE',
    "last_synced_at" TIMESTAMP(3),
    "sync_token" TEXT,
    "oauth_access_token" TEXT,
    "oauth_refresh_token" TEXT,
    "oauth_expires_at" TIMESTAMP(3),
    "oauth_scope" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCalendarAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CrmCalendarEvent" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "title" TEXT NOT NULL DEFAULT '(no title)',
    "description" TEXT,
    "location" TEXT,
    "html_link" TEXT,
    "status" TEXT,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCalendarAccount_workspace_id_user_id_provider_key" ON "CrmCalendarAccount"("workspace_id", "user_id", "provider");
CREATE INDEX IF NOT EXISTS "CrmCalendarAccount_workspace_id_sync_status_idx" ON "CrmCalendarAccount"("workspace_id", "sync_status");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCalendarEvent_workspace_id_external_id_key" ON "CrmCalendarEvent"("workspace_id", "external_id");
CREATE INDEX IF NOT EXISTS "CrmCalendarEvent_workspace_id_starts_at_idx" ON "CrmCalendarEvent"("workspace_id", "starts_at");
CREATE INDEX IF NOT EXISTS "CrmCalendarEvent_account_id_starts_at_idx" ON "CrmCalendarEvent"("account_id", "starts_at");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "CrmCalendarAccount" ADD CONSTRAINT "CrmCalendarAccount_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmCalendarAccount" ADD CONSTRAINT "CrmCalendarAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmCalendarEvent" ADD CONSTRAINT "CrmCalendarEvent_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CrmCalendarEvent" ADD CONSTRAINT "CrmCalendarEvent_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "CrmCalendarAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
