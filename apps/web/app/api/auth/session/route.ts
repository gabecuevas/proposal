import { NextResponse, type NextRequest } from "next/server";
import { requireSessionFromRequest } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const session = await requireSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
