-- CreateEnum
CREATE TYPE "SupportConversationStatus" AS ENUM ('OPEN', 'WAITING_ON_CUSTOMER', 'RESOLVED');

-- CreateEnum
CREATE TYPE "SupportConversationPriority" AS ENUM ('NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "SupportMessageSource" AS ENUM ('IN_APP', 'EMAIL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SupportMessageVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "InAppCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');



-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "city_source" TEXT,
ADD COLUMN     "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_active_at" TIMESTAMP(3),
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "timezone_source" TEXT,
ADD COLUMN     "tracked_since" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActivitySession" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "customer_user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "subject" TEXT NOT NULL,
    "status" "SupportConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportConversationPriority" NOT NULL DEFAULT 'NORMAL',
    "assignee_admin_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'messenger',
    "campaign_delivery_id" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_public_preview" TEXT,
    "customer_unread_count" INTEGER NOT NULL DEFAULT 0,
    "admin_unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_user_id" TEXT,
    "visibility" "SupportMessageVisibility" NOT NULL DEFAULT 'PUBLIC',
    "source" "SupportMessageSource" NOT NULL DEFAULT 'IN_APP',
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "client_op_id" TEXT,
    "sequence" INTEGER NOT NULL,
    "email_message_id" TEXT,
    "provider_email_id" TEXT,
    "delivery_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReadState" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportReadState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportContactNote" (
    "id" TEXT NOT NULL,
    "subject_user_id" TEXT NOT NULL,
    "author_admin_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReplyToken" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportReplyToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportEmailDelivery" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT,
    "to_email" TEXT NOT NULL,
    "provider_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_expires_at" TIMESTAMP(3),
    "run_after" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAuditEvent" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedAudience" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters_json" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InAppCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "sender_user_id" TEXT,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "cta_label" TEXT,
    "cta_url" TEXT,
    "filters_json" JSONB NOT NULL,
    "delivery_mode" TEXT NOT NULL DEFAULT 'ongoing',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "published_version" INTEGER NOT NULL DEFAULT 1,
    "snapshot_json" JSONB,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InAppCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDelivery" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "campaign_version" INTEGER NOT NULL DEFAULT 1,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewed_at" TIMESTAMP(3),
    "clicked_at" TIMESTAMP(3),
    "replied_at" TIMESTAMP(3),
    "conversation_id" TEXT,

    CONSTRAINT "CampaignDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmailEvent" (
    "id" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "provider_email_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "raw_meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "InboundEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivitySession_user_id_started_at_idx" ON "ActivitySession"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "ActivitySession_user_id_last_seen_at_idx" ON "ActivitySession"("user_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "ActivitySession_workspace_id_started_at_idx" ON "ActivitySession"("workspace_id", "started_at");

-- CreateIndex
CREATE INDEX "SupportConversation_status_last_message_at_idx" ON "SupportConversation"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "SupportConversation_assignee_admin_id_status_last_message_a_idx" ON "SupportConversation"("assignee_admin_id", "status", "last_message_at");

-- CreateIndex
CREATE INDEX "SupportConversation_customer_user_id_last_message_at_idx" ON "SupportConversation"("customer_user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "SupportConversation_workspace_id_last_message_at_idx" ON "SupportConversation"("workspace_id", "last_message_at");

-- CreateIndex
CREATE INDEX "SupportMessage_conversation_id_created_at_idx" ON "SupportMessage"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "SupportMessage_provider_email_id_idx" ON "SupportMessage"("provider_email_id");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_conversation_id_sequence_key" ON "SupportMessage"("conversation_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_sender_user_id_client_op_id_key" ON "SupportMessage"("sender_user_id", "client_op_id");

-- CreateIndex
CREATE UNIQUE INDEX "SupportReadState_conversation_id_user_id_key" ON "SupportReadState"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "SupportContactNote_subject_user_id_created_at_idx" ON "SupportContactNote"("subject_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "SupportReplyToken_token_hash_key" ON "SupportReplyToken"("token_hash");

-- CreateIndex
CREATE INDEX "SupportReplyToken_conversation_id_recipient_user_id_idx" ON "SupportReplyToken"("conversation_id", "recipient_user_id");

-- CreateIndex
CREATE INDEX "SupportEmailDelivery_status_scheduled_at_idx" ON "SupportEmailDelivery"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "SupportEmailDelivery_conversation_id_created_at_idx" ON "SupportEmailDelivery"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "SupportJob_idempotency_key_key" ON "SupportJob"("idempotency_key");

-- CreateIndex
CREATE INDEX "SupportJob_status_run_after_idx" ON "SupportJob"("status", "run_after");

-- CreateIndex
CREATE INDEX "SupportAuditEvent_action_created_at_idx" ON "SupportAuditEvent"("action", "created_at");

-- CreateIndex
CREATE INDEX "SupportAuditEvent_actor_user_id_created_at_idx" ON "SupportAuditEvent"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "InAppCampaign_status_starts_at_idx" ON "InAppCampaign"("status", "starts_at");

-- CreateIndex
CREATE INDEX "CampaignDelivery_user_id_delivered_at_idx" ON "CampaignDelivery"("user_id", "delivered_at");

-- CreateIndex
CREATE INDEX "CampaignDelivery_campaign_id_delivered_at_idx" ON "CampaignDelivery"("campaign_id", "delivered_at");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDelivery_campaign_id_user_id_campaign_version_key" ON "CampaignDelivery"("campaign_id", "user_id", "campaign_version");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmailEvent_provider_event_id_key" ON "InboundEmailEvent"("provider_event_id");

-- CreateIndex
CREATE INDEX "InboundEmailEvent_status_created_at_idx" ON "InboundEmailEvent"("status", "created_at");

-- CreateIndex
CREATE INDEX "User_is_platform_admin_idx" ON "User"("is_platform_admin");

-- CreateIndex
CREATE INDEX "User_last_login_at_idx" ON "User"("last_login_at");

-- CreateIndex
CREATE INDEX "User_last_active_at_idx" ON "User"("last_active_at");

-- CreateIndex
CREATE INDEX "User_created_at_idx" ON "User"("created_at");

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReadState" ADD CONSTRAINT "SupportReadState_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReadState" ADD CONSTRAINT "SupportReadState_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportContactNote" ADD CONSTRAINT "SupportContactNote_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportContactNote" ADD CONSTRAINT "SupportContactNote_author_admin_id_fkey" FOREIGN KEY ("author_admin_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReplyToken" ADD CONSTRAINT "SupportReplyToken_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportEmailDelivery" ADD CONSTRAINT "SupportEmailDelivery_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "InAppCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
