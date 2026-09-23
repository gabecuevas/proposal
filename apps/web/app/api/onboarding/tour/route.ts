import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";

const bodySchema = z.object({
  action: z.enum(["dismiss", "complete"]),
});

export async function POST(request: NextRequest) {
  let auth;
  try {
    auth = await getRequestAuthContext(request);
  } catch {
    return errorResponse(request, { status: 401, code: "unauthorized", message: "Unauthorized" });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Invalid tour action",
    });
  }

  const now = new Date();
  await prisma.userWorkspaceOnboarding.upsert({
    where: {
      user_id_workspace_id: {
        user_id: auth.userId,
        workspace_id: auth.workspaceId,
      },
    },
    create: {
      user_id: auth.userId,
      workspace_id: auth.workspaceId,
      ...(parsed.data.action === "dismiss"
        ? { tour_dismissed_at: now }
        : { tour_completed_at: now }),
    },
    update:
      parsed.data.action === "dismiss"
        ? { tour_dismissed_at: now }
        : { tour_completed_at: now },
  });

  return jsonWithRequestId(request, { ok: true });
}
