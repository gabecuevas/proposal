import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  createEmailAccount,
  listEmailAccounts,
  parseEmailSyncProvider,
  PERSONAL_EMAIL_ACCOUNT_LIMIT,
  serializeEmailAccount,
} from "@/lib/crm/emails";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const accounts = await listEmailAccounts(auth.workspaceId);
  return jsonWithRequestId(request, {
    providerDefault: "GOOGLE",
    personalLimit: PERSONAL_EMAIL_ACCOUNT_LIMIT,
    accounts: accounts.map(serializeEmailAccount),
  });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return jsonWithRequestId(request, { error: "Invalid request body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonWithRequestId(request, { error: "Enter a valid email address." }, { status: 400 });
  }

  const provider = parseEmailSyncProvider(body.provider);
  if (!provider) {
    return jsonWithRequestId(request, { error: "Choose a valid email provider." }, { status: 400 });
  }

  const authMethod = body.authMethod === "imap" ? "imap" : "oauth";
  if (provider === "IMAP" && authMethod !== "imap") {
    return jsonWithRequestId(request, { error: "IMAP accounts require server settings." }, { status: 400 });
  }
  if (provider !== "IMAP" && authMethod === "imap") {
    return jsonWithRequestId(request, { error: "OAuth providers do not use IMAP settings." }, { status: 400 });
  }

  let imapHost: string | null = null;
  let imapPort: number | null = null;
  let smtpHost: string | null = null;
  let smtpPort: number | null = null;
  let credentialsConfigured = false;

  if (authMethod === "imap") {
    const password = typeof body.password === "string" ? body.password : "";
    if (!password.trim()) {
      return jsonWithRequestId(request, { error: "Password is required." }, { status: 400 });
    }
    // Password is used only to validate the request shape. We do not persist it;
    // IMAP handshake / secret vault lands with the sync worker.
    void password;

    imapHost = typeof body.imapHost === "string" ? body.imapHost.trim() : "";
    smtpHost = typeof body.smtpHost === "string" ? body.smtpHost.trim() : "";
    imapPort = typeof body.imapPort === "number" ? body.imapPort : Number(body.imapPort);
    smtpPort = typeof body.smtpPort === "number" ? body.smtpPort : Number(body.smtpPort);

    if (!imapHost || !smtpHost) {
      return jsonWithRequestId(
        request,
        { error: "Enter both IMAP and SMTP server hosts." },
        { status: 400 },
      );
    }
    if (!Number.isInteger(imapPort) || imapPort! < 1 || imapPort! > 65535) {
      return jsonWithRequestId(request, { error: "Enter a valid IMAP port." }, { status: 400 });
    }
    if (!Number.isInteger(smtpPort) || smtpPort! < 1 || smtpPort! > 65535) {
      return jsonWithRequestId(request, { error: "Enter a valid SMTP port." }, { status: 400 });
    }
    credentialsConfigured = true;
  }

  try {
    const account = await createEmailAccount(auth.workspaceId, {
      email,
      provider,
      userId: auth.userId,
      imapHost,
      imapPort,
      smtpHost,
      smtpPort,
      credentialsConfigured,
    });
    return jsonWithRequestId(request, { account: serializeEmailAccount(account) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect email account";
    const status = message.includes("limit") || message.includes("already") ? 409 : 500;
    return jsonWithRequestId(request, { error: message }, { status });
  }
}
