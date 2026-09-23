import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  personalTimezone: z.string().trim().min(1).max(80).optional().nullable(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid profile payload",
    });
  }

  const data: { name?: string; personal_timezone?: string | null } = {};
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name;
  }
  if (parsed.data.personalTimezone !== undefined) {
    data.personal_timezone = parsed.data.personalTimezone;
  }
  if (Object.keys(data).length === 0) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "No updatable fields provided",
    });
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data,
  });
  const payload = await buildSessionPayloadFromUser(user);
  return jsonWithSessionCookie(
    request,
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        personalTimezone: user.personal_timezone,
      },
    },
    payload,
  );
}
