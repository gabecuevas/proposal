import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { buildSessionPayloadFromUser, postAuthRedirectPath } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";
import { confirmCheckoutSession, isStripeBillingConfigured } from "@/lib/billing/stripe-billing";

const bodySchema = z.object({ sessionId: z.string().min(1).max(255) });

export async function POST(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }
  if (!session.workspaceId) {
    return errorResponse(request, { status: 403, code: "forbidden", message: "No workspace" });
  }
  if (!isStripeBillingConfigured()) {
    return errorResponse(request, {
      status: 503,
      code: "billing_unavailable",
      message: "Billing is not configured.",
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Missing checkout session",
    });
  }

  let confirmed = false;
  try {
    confirmed = await confirmCheckoutSession(parsed.data.sessionId, session.workspaceId);
  } catch (error) {
    console.error("[billing] checkout confirm failed", error);
  }
  if (!confirmed) {
    return errorResponse(request, {
      status: 409,
      code: "checkout_incomplete",
      message: "We couldn't confirm your payment yet. Refresh in a moment or contact support.",
    });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const payload = await buildSessionPayloadFromUser(user, session.workspaceId);
  return jsonWithSessionCookie(
    request,
    { ok: true, redirectHint: postAuthRedirectPath(payload) },
    payload,
  );
}
