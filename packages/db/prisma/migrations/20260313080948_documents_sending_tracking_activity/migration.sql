-- CreateTable
CREATE TABLE "DocumentActivityEvent" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_recipient_id" TEXT,
    "metadata_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentActivityEvent_document_id_created_at_idx" ON "DocumentActivityEvent"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "DocumentActivityEvent_workspace_id_created_at_idx" ON "DocumentActivityEvent"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "DocumentActivityEvent" ADD CONSTRAINT "DocumentActivityEvent_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentActivityEvent" ADD CONSTRAINT "DocumentActivityEvent_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
