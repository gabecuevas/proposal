ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "billing_interval" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "plan_selected_at" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "seat_limit" INTEGER;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "subscription_status" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "subscription_current_period_end" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "subscription_cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_stripe_customer_id_key" ON "Workspace"("stripe_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_stripe_subscription_id_key" ON "Workspace"("stripe_subscription_id");
