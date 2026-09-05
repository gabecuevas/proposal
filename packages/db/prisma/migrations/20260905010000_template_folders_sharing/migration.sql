-- CreateTable
CREATE TABLE "TemplateFolder" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateFolderShare" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateFolderShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateShare" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateShare_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Template" ADD COLUMN "folder_id" TEXT;
ALTER TABLE "Template" ADD COLUMN "updated_by" TEXT;

-- CreateIndex
CREATE INDEX "TemplateFolder_workspace_id_parent_id_idx" ON "TemplateFolder"("workspace_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateFolderShare_folder_id_user_id_key" ON "TemplateFolderShare"("folder_id", "user_id");

-- CreateIndex
CREATE INDEX "TemplateFolderShare_user_id_idx" ON "TemplateFolderShare"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateShare_template_id_user_id_key" ON "TemplateShare"("template_id", "user_id");

-- CreateIndex
CREATE INDEX "TemplateShare_user_id_idx" ON "TemplateShare"("user_id");

-- CreateIndex
CREATE INDEX "Template_workspace_id_folder_id_idx" ON "Template"("workspace_id", "folder_id");

-- AddForeignKey
ALTER TABLE "TemplateFolder" ADD CONSTRAINT "TemplateFolder_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFolder" ADD CONSTRAINT "TemplateFolder_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "TemplateFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateFolderShare" ADD CONSTRAINT "TemplateFolderShare_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "TemplateFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "TemplateFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateShare" ADD CONSTRAINT "TemplateShare_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
