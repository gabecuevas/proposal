import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);

  const members = await prisma.workspaceMember.findMany({
    where: { workspace_id: auth.workspaceId },
    orderBy: [{ created_at: "asc" }],
    select: {
      id: true,
      role: true,
      created_at: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return jsonWithRequestId(request, {
    members: members.map((member) => ({
      id: member.id,
      role: member.role,
      joinedAt: member.created_at.toISOString(),
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
    })),
  });
}
