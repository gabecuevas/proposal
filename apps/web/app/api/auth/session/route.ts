import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { displayNameFromEmail } from "@/lib/crm/display-name";

export async function GET(request: NextRequest) {
  const session = await requireSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      ...session,
      name: user.name.trim() || displayNameFromEmail(user.email),
    },
  });
}
