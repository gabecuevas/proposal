import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  SUDO_ADMIN_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import { endSudoSession } from "@/lib/support/account-admin";

async function exitSudo(request: NextRequest, reason: string) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "");
  if (session?.impersonationId) {
    await endSudoSession(session.impersonationId, reason).catch((error) => {
      console.error("[admin/sudo] end failed", error);
    });
  }

  const adminToken = request.cookies.get(SUDO_ADMIN_COOKIE)?.value ?? "";
  const adminSession = adminToken ? await verifySessionToken(adminToken) : null;
  const restorable =
    adminSession &&
    !adminSession.impersonationId &&
    (!session?.impersonatorUserId || adminSession.userId === session.impersonatorUserId);

  return { restorable: Boolean(restorable), adminToken, wasSudo: Boolean(session?.impersonationId) };
}

function finish(response: NextResponse, restorable: boolean, adminToken: string) {
  if (restorable) {
    applySessionCookie(response, adminToken, SESSION_MAX_AGE);
  } else {
    response.cookies.set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  }
  response.cookies.set(SUDO_ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function POST(request: NextRequest) {
  const { restorable, adminToken } = await exitSudo(request, "admin_exit");
  const response = NextResponse.json({
    ok: true,
    redirectHint: restorable ? "/admin/contacts" : "/login",
  });
  return finish(response, restorable, adminToken);
}

/** Used when a sudo session expires or is closed server-side. */
export async function GET(request: NextRequest) {
  const { restorable, adminToken } = await exitSudo(request, "expired");
  const target = restorable ? "/admin/contacts" : "/login?error=sudo_ended";
  return finish(NextResponse.redirect(new URL(target, request.url)), restorable, adminToken);
}
