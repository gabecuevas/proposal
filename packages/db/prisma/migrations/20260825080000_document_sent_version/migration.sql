-- CreateTable
CREATE TABLE "DocumentSentVersion" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "editor_json" JSONB NOT NULL,
    "pricing_json" JSONB NOT NULL,
    "variables_json" JSONB NOT NULL,
    "resolved_variables_json" JSONB NOT NULL,
    "recipients_json" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "snapshot_hash" TEXT NOT NULL,
    "snapshot_kind" TEXT NOT NULL DEFAULT 'send',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSentVersion_document_id_version_number_key" ON "DocumentSentVersion"("document_id", "version_number");

-- CreateIndex
CREATE INDEX "DocumentSentVersion_document_id_sent_at_idx" ON "DocumentSentVersion"("document_id", "sent_at");

-- CreateIndex
CREATE INDEX "DocumentSentVersion_workspace_id_created_at_idx" ON "DocumentSentVersion"("workspace_id", "created_at");

-- AddForeignKey
ALTER TABLE "DocumentSentVersion" ADD CONSTRAINT "DocumentSentVersion_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSentVersion" ADD CONSTRAINT "DocumentSentVersion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
