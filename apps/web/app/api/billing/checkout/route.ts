import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { MAX_SEATS_PER_CHECKOUT } from "@/lib/billing/plans";
import { createSubscriptionCheckout, isStripeBillingConfigured } from "@/lib/billing/stripe-billing";

const bodySchema = z.object({
  plan: z.enum(["small_business", "big_business"]),
  interval: z.enum(["monthly", "annual"]),
  seats: z.number().int().min(1).max(MAX_SEATS_PER_CHECKOUT).default(1),
  context: z.enum(["onboarding", "settings"]).default("settings"),
});

export async function POST(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }
  if (!session.workspaceId || !session.companySetupComplete) {
    return errorResponse(request, {
      status: 403,
      code: "forbidden",
      message: "Complete company setup first.",
    });
  }
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return errorResponse(request, {
      status: 403,
      code: "forbidden",
      message: "Only workspace owners and admins can manage billing.",
    });
  }
  if (session.impersonationId) {
    return errorResponse(request, {
      status: 403,
      code: "forbidden",
      message: "Billing is unavailable during a support session.",
    });
  }
  if (!isStripeBillingConfigured()) {
    return errorResponse(request, {
      status: 503,
      code: "billing_unavailable",
      message: "Paid plans are not available yet. Start with the free trial.",
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid plan selection",
    });
  }

  const { plan, interval, seats, context } = parsed.data;
  const returnPath = context === "onboarding" ? "/onboarding/plan" : "/app/settings/billing";

  try {
    const url = await createSubscriptionCheckout({
      workspaceId: session.workspaceId,
      email: session.email,
      plan,
      interval,
      seats,
      successPath: `${returnPath}?checkout=success`,
      cancelPath: `${returnPath}?checkout=canceled`,
    });
    return jsonWithRequestId(request, { url });
  } catch (error) {
    console.error("[billing] checkout failed", error);
    return errorResponse(request, {
      status: 502,
      code: "checkout_failed",
      message: "We couldn't start checkout. Please try again in a moment.",
    });
  }
}
