-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'MEETING', 'TASK', 'DEADLINE', 'EMAIL', 'LUNCH');

-- CreateEnum
CREATE TYPE "CrmActivityPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CrmActivityAvailability" AS ENUM ('FREE', 'BUSY');

-- CreateEnum
CREATE TYPE "CrmTimelineEventType" AS ENUM ('RECORD_CREATED', 'FIELD_CHANGED', 'NOTE_SAVED', 'ACTIVITY_CREATED', 'ACTIVITY_UPDATED', 'ACTIVITY_COMPLETED');

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "assignee_user_id" TEXT,
    "contact_id" TEXT,
    "lead_id" TEXT,
    "company_id" TEXT,
    "activity_type" "CrmActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "video_call_url" TEXT,
    "notes" TEXT,
    "priority" "CrmActivityPriority",
    "availability" "CrmActivityAvailability" NOT NULL DEFAULT 'FREE',
    "due_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTimelineEvent" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "contact_id" TEXT,
    "lead_id" TEXT,
    "company_id" TEXT,
    "activity_id" TEXT,
    "event_type" "CrmTimelineEventType" NOT NULL,
    "field_key" TEXT,
    "field_label" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmActivity_workspace_id_due_at_idx" ON "CrmActivity"("workspace_id", "due_at");

-- CreateIndex
CREATE INDEX "CrmActivity_workspace_id_assignee_user_id_due_at_idx" ON "CrmActivity"("workspace_id", "assignee_user_id", "due_at");

-- CreateIndex
CREATE INDEX "CrmActivity_contact_id_due_at_idx" ON "CrmActivity"("contact_id", "due_at");

-- CreateIndex
CREATE INDEX "CrmActivity_lead_id_due_at_idx" ON "CrmActivity"("lead_id", "due_at");

-- CreateIndex
CREATE INDEX "CrmActivity_company_id_due_at_idx" ON "CrmActivity"("company_id", "due_at");

-- CreateIndex
CREATE INDEX "CrmTimelineEvent_workspace_id_created_at_idx" ON "CrmTimelineEvent"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "CrmTimelineEvent_contact_id_created_at_idx" ON "CrmTimelineEvent"("contact_id", "created_at");

-- CreateIndex
CREATE INDEX "CrmTimelineEvent_lead_id_created_at_idx" ON "CrmTimelineEvent"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "CrmTimelineEvent_company_id_created_at_idx" ON "CrmTimelineEvent"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTimelineEvent" ADD CONSTRAINT "CrmTimelineEvent_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTimelineEvent" ADD CONSTRAINT "CrmTimelineEvent_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTimelineEvent" ADD CONSTRAINT "CrmTimelineEvent_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTimelineEvent" ADD CONSTRAINT "CrmTimelineEvent_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTimelineEvent" ADD CONSTRAINT "CrmTimelineEvent_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTimelineEvent" ADD CONSTRAINT "CrmTimelineEvent_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "CrmActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
