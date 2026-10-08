import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { createBillingPortalSession, isStripeBillingConfigured } from "@/lib/billing/stripe-billing";

export async function POST(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }
  if (!session.workspaceId) {
    return errorResponse(request, { status: 403, code: "forbidden", message: "No workspace" });
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
      message: "Billing is not configured.",
    });
  }

  try {
    const url = await createBillingPortalSession({
      workspaceId: session.workspaceId,
      returnPath: "/app/settings/billing",
    });
    return jsonWithRequestId(request, { url });
  } catch (error) {
    console.error("[billing] portal failed", error);
    return errorResponse(request, {
      status: 502,
      code: "portal_failed",
      message: "We couldn't open the billing portal. Please try again in a moment.",
    });
  }
}
