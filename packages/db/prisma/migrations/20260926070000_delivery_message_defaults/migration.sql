-- Per-user default Review & Send delivery message for each document kind.
CREATE TABLE "DeliveryMessageDefault" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryMessageDefault_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryMessageDefault_workspace_id_user_id_kind_key"
ON "DeliveryMessageDefault"("workspace_id", "user_id", "kind");

ALTER TABLE "DeliveryMessageDefault"
ADD CONSTRAINT "DeliveryMessageDefault_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryMessageDefault"
ADD CONSTRAINT "DeliveryMessageDefault_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
