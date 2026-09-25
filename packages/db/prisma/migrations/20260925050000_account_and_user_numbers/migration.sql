-- Additive: sequential Account IDs (Workspace) and User IDs (User), backfilled in signup order.

CREATE SEQUENCE IF NOT EXISTS "Workspace_account_number_seq";
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "account_number" INTEGER;
UPDATE "Workspace" AS w
SET "account_number" = numbered.n
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "Workspace"
) AS numbered
WHERE w."id" = numbered."id" AND w."account_number" IS NULL;
SELECT setval('"Workspace_account_number_seq"', COALESCE((SELECT MAX("account_number") FROM "Workspace"), 0) + 1, false);
ALTER TABLE "Workspace" ALTER COLUMN "account_number" SET DEFAULT nextval('"Workspace_account_number_seq"');
ALTER TABLE "Workspace" ALTER COLUMN "account_number" SET NOT NULL;
ALTER SEQUENCE "Workspace_account_number_seq" OWNED BY "Workspace"."account_number";
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_account_number_key" ON "Workspace"("account_number");

CREATE SEQUENCE IF NOT EXISTS "User_user_number_seq";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "user_number" INTEGER;
UPDATE "User" AS u
SET "user_number" = numbered.n
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at", "id") AS n FROM "User"
) AS numbered
WHERE u."id" = numbered."id" AND u."user_number" IS NULL;
SELECT setval('"User_user_number_seq"', COALESCE((SELECT MAX("user_number") FROM "User"), 0) + 1, false);
ALTER TABLE "User" ALTER COLUMN "user_number" SET DEFAULT nextval('"User_user_number_seq"');
ALTER TABLE "User" ALTER COLUMN "user_number" SET NOT NULL;
ALTER SEQUENCE "User_user_number_seq" OWNED BY "User"."user_number";
CREATE UNIQUE INDEX IF NOT EXISTS "User_user_number_key" ON "User"("user_number");
