import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { parseAndValidateAllowedIps } from "@/lib/webhooks/policy";

type Params = { params: Promise<{ endpointId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");
  const { endpointId } = await params;

  const existing = await prisma.webhookEndpoint.findFirst({
    where: {
      id: endpointId,
      workspace_id: auth.workspaceId,
    },
  });
  if (!existing) {
    return errorResponse(request, {
      status: 404,
      code: "webhook_endpoint_not_found",
      message: "Webhook endpoint not found",
    });
  }

  const payload = (await request.json()) as {
    url?: string;
    events?: string[];
    allowed_ips?: string[];
    require_mtls?: boolean;
    mtls_cert_fingerprint?: string;
    is_active?: boolean;
    rotate_secret?: boolean;
  };
  const allowedIps = parseAndValidateAllowedIps(payload.allowed_ips);
  if (allowedIps === null) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "allowed_ips must contain valid IP addresses",
    });
  }
  const requireMtls = payload.require_mtls ?? existing.require_mtls;
  const mtlsFingerprint = payload.mtls_cert_fingerprint?.trim() ?? existing.mtls_cert_fingerprint;
  if (requireMtls && !mtlsFingerprint) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "mtls_cert_fingerprint is required when require_mtls is true",
    });
  }

  const endpoint = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      url: payload.url?.trim() || existing.url,
      events_json: (Array.isArray(payload.events) ? payload.events : existing.events_json) as InputJsonValue,
      allowed_ips_json:
        (Array.isArray(payload.allowed_ips) ? allowedIps : existing.allowed_ips_json) as InputJsonValue,
      require_mtls: requireMtls,
      mtls_cert_fingerprint: mtlsFingerprint,
      is_active: payload.is_active ?? existing.is_active,
      secret: payload.rotate_secret ? `whsec_${randomUUID().replaceAll("-", "")}` : existing.secret,
    },
  });

  return jsonWithRequestId(request, {
    endpoint: {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events_json,
      allowed_ips: endpoint.allowed_ips_json,
      require_mtls: endpoint.require_mtls,
      mtls_cert_fingerprint: endpoint.mtls_cert_fingerprint,
      is_active: endpoint.is_active,
    },
    secret: payload.rotate_secret ? endpoint.secret : undefined,
  });
}
