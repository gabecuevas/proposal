-- CreateTable
CREATE TABLE "ContentBlockFolder" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentBlockFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlockFolderShare" (
    "id" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentBlockFolderShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlockShare" (
    "id" TEXT NOT NULL,
    "block_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentBlockShare_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ContentBlock" ADD COLUMN "folder_id" TEXT;
ALTER TABLE "ContentBlock" ADD COLUMN "created_by" TEXT;
ALTER TABLE "ContentBlock" ADD COLUMN "updated_by" TEXT;

-- CreateIndex
CREATE INDEX "ContentBlockFolder_workspace_id_parent_id_idx" ON "ContentBlockFolder"("workspace_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlockFolderShare_folder_id_user_id_key" ON "ContentBlockFolderShare"("folder_id", "user_id");

-- CreateIndex
CREATE INDEX "ContentBlockFolderShare_user_id_idx" ON "ContentBlockFolderShare"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlockShare_block_id_user_id_key" ON "ContentBlockShare"("block_id", "user_id");

-- CreateIndex
CREATE INDEX "ContentBlockShare_user_id_idx" ON "ContentBlockShare"("user_id");

-- CreateIndex
CREATE INDEX "ContentBlock_workspace_id_folder_id_idx" ON "ContentBlock"("workspace_id", "folder_id");

-- AddForeignKey
ALTER TABLE "ContentBlockFolder" ADD CONSTRAINT "ContentBlockFolder_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlockFolder" ADD CONSTRAINT "ContentBlockFolder_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ContentBlockFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlockFolderShare" ADD CONSTRAINT "ContentBlockFolderShare_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "ContentBlockFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlock" ADD CONSTRAINT "ContentBlock_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "ContentBlockFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlockShare" ADD CONSTRAINT "ContentBlockShare_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "ContentBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
