import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";
import type { NextRequest } from "next/server";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { parseAndValidateAllowedIps } from "@/lib/webhooks/policy";

const DEFAULT_EVENTS = ["document.sent", "document.finalized"];

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");
  const pagination = parseCursorPagination(request, 50);

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      workspace_id: auth.workspaceId,
      created_at: pagination.before ? { lt: pagination.before } : undefined,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: pagination.limit + 1,
  });
  const rows = endpoints.map((endpoint) => ({
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events_json,
    allowed_ips: endpoint.allowed_ips_json,
    require_mtls: endpoint.require_mtls,
    mtls_cert_fingerprint: endpoint.mtls_cert_fingerprint,
    is_active: endpoint.is_active,
    created_at: endpoint.created_at,
    updated_at: endpoint.updated_at,
  }));
  const page = getNextCursorFromTimestampPage(rows, pagination.limit, (item) => item.created_at);
  return jsonWithRequestId(request, {
    endpoints: page.items.map((endpoint) => ({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      allowed_ips: endpoint.allowed_ips,
      require_mtls: endpoint.require_mtls,
      mtls_cert_fingerprint: endpoint.mtls_cert_fingerprint,
      is_active: endpoint.is_active,
      created_at: endpoint.created_at,
      updated_at: endpoint.updated_at,
    })),
    nextCursor: page.nextCursor,
  });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const payload = (await request.json()) as {
    url?: string;
    events?: string[];
    allowed_ips?: string[];
    require_mtls?: boolean;
    mtls_cert_fingerprint?: string;
  };
  const url = payload.url?.trim();
  if (!url) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "url is required",
    });
  }
  const events = Array.isArray(payload.events) && payload.events.length > 0 ? payload.events : DEFAULT_EVENTS;
  const allowedIps = parseAndValidateAllowedIps(payload.allowed_ips);
  if (allowedIps === null) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "allowed_ips must contain valid IP addresses",
    });
  }
  const requireMtls = Boolean(payload.require_mtls);
  const mtlsFingerprint = payload.mtls_cert_fingerprint?.trim() || null;
  if (requireMtls && !mtlsFingerprint) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "mtls_cert_fingerprint is required when require_mtls is true",
    });
  }

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      workspace_id: auth.workspaceId,
      url,
      secret: `whsec_${randomUUID().replaceAll("-", "")}`,
      events_json: events as InputJsonValue,
      allowed_ips_json: allowedIps as InputJsonValue,
      require_mtls: requireMtls,
      mtls_cert_fingerprint: mtlsFingerprint,
      is_active: true,
      created_by: auth.userId,
    },
  });

  return jsonWithRequestId(
    request,
    {
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events_json,
        allowed_ips: endpoint.allowed_ips_json,
        require_mtls: endpoint.require_mtls,
        mtls_cert_fingerprint: endpoint.mtls_cert_fingerprint,
        is_active: endpoint.is_active,
      },
      secret: endpoint.secret,
    },
    { status: 201 },
  );
}
