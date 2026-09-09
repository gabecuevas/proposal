-- CreateEnum
CREATE TYPE "CrmEmailFolder" AS ENUM ('INBOX', 'DRAFTS', 'OUTBOX', 'SENT', 'TRASH');

-- CreateEnum
CREATE TYPE "CrmEmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CrmEmailSyncProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "CrmEmailSyncStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'ERROR');

-- CreateTable
CREATE TABLE "CrmEmailAccount" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "provider" "CrmEmailSyncProvider" NOT NULL DEFAULT 'GOOGLE',
    "email" TEXT NOT NULL,
    "sender_name" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sync_status" "CrmEmailSyncStatus" NOT NULL DEFAULT 'INACTIVE',
    "sync_from_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmEmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEmailMessage" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "account_id" TEXT,
    "folder" "CrmEmailFolder" NOT NULL DEFAULT 'INBOX',
    "direction" "CrmEmailDirection" NOT NULL,
    "from_name" TEXT,
    "from_address" TEXT NOT NULL,
    "to_addresses" JSONB NOT NULL,
    "cc_addresses" JSONB,
    "subject" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "body_text" TEXT,
    "body_html" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_id" TEXT,
    "contact_id" TEXT,
    "lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmEmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmEmailAccount_workspace_id_sync_status_idx" ON "CrmEmailAccount"("workspace_id", "sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "CrmEmailAccount_workspace_id_email_key" ON "CrmEmailAccount"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "CrmEmailMessage_workspace_id_folder_message_at_idx" ON "CrmEmailMessage"("workspace_id", "folder", "message_at");

-- CreateIndex
CREATE INDEX "CrmEmailMessage_workspace_id_is_read_folder_idx" ON "CrmEmailMessage"("workspace_id", "is_read", "folder");

-- CreateIndex
CREATE UNIQUE INDEX "CrmEmailMessage_workspace_id_external_id_key" ON "CrmEmailMessage"("workspace_id", "external_id");

-- AddForeignKey
ALTER TABLE "CrmEmailAccount" ADD CONSTRAINT "CrmEmailAccount_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailAccount" ADD CONSTRAINT "CrmEmailAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailMessage" ADD CONSTRAINT "CrmEmailMessage_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailMessage" ADD CONSTRAINT "CrmEmailMessage_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "CrmEmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
