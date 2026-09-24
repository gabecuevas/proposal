import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ userId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const { userId } = await params;
  const body = (await request.json()) as { body?: string };
  const text = body.body?.trim();
  if (!text) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "body is required",
    });
  }

  const subject = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!subject) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Contact not found",
    });
  }

  const note = await prisma.supportContactNote.create({
    data: {
      subject_user_id: userId,
      author_admin_id: admin.userId,
      body: text,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return jsonWithRequestId(request, {
    note: {
      id: note.id,
      body: note.body,
      createdAt: note.created_at.toISOString(),
      author: note.author,
    },
  });
}
