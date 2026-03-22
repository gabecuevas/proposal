-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company_name" TEXT,
    "title" TEXT,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "custom_fields_json" JSONB,
    "tags" JSONB NOT NULL,
    "color_label" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_workspace_id_updated_at_idx" ON "Contact"("workspace_id", "updated_at");
CREATE INDEX "Contact_workspace_id_full_name_idx" ON "Contact"("workspace_id", "full_name");
CREATE INDEX "Contact_workspace_id_email_idx" ON "Contact"("workspace_id", "email");

-- AddForeignKey
ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_workspace_id_fkey"
FOREIGN KEY ("workspace_id")
REFERENCES "Workspace"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Contact"
ADD CONSTRAINT "Contact_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
