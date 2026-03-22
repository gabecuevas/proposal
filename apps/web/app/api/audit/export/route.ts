import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { computeAuditChecksum } from "@/lib/audit/checksum";
import { fetchAuditExportRows } from "@/lib/audit/export-data";
import { createAuditExportLedgerEntry } from "@/lib/audit/export-ledger";
import { verifyAuditExportToken } from "@/lib/audit/export-token";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { getRequestId } from "@/lib/observability/request-id";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");
  const requestId = getRequestId(request);
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "token is required",
    });
  }
  const verified = await verifyAuditExportToken(token);
  if (!verified) {
    return errorResponse(request, {
      status: 401,
      code: "invalid_export_token",
      message: "Export token is invalid or expired",
    });
  }
  if (verified.workspaceId !== auth.workspaceId) {
    return errorResponse(request, {
      status: 403,
      code: "forbidden",
      message: "Export token workspace mismatch",
    });
  }
  const cutoff = verified.before ? new Date(verified.before) : undefined;
  const safeCutoff = cutoff && !Number.isNaN(cutoff.getTime()) ? cutoff : undefined;
  const type = verified.exportType;
  const limit = Math.min(5000, Math.max(1, Math.trunc(verified.limit)));
  const rows = await fetchAuditExportRows({
    workspaceId: auth.workspaceId,
    exportType: type,
    before: safeCutoff,
    limit,
  });
  const checksum = computeAuditChecksum({
    workspaceId: auth.workspaceId,
    type,
    before: safeCutoff?.toISOString(),
    rows,
  });
  const ledger = await createAuditExportLedgerEntry({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    exportType: type,
    beforeAt: safeCutoff,
    exportLimit: limit,
    rowCount: rows.length,
    checksum,
    metadata: {
      requestId,
      tokenActorUserId: verified.actorUserId,
    },
  });

  if (type === "activity") {
    const lines = rows.map((row) => JSON.stringify(row)).join("\n");
    const response = new Response(lines, {
      status: 200,
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "content-disposition": `attachment; filename="audit-activity-${Date.now()}.ndjson"`,
        "x-request-id": requestId,
        "x-audit-checksum": checksum,
        "x-audit-ledger-id": ledger.id,
        "x-audit-ledger-hash": ledger.entry_hash,
      },
    });
    return response;
  }
  const lines = rows.map((row) => JSON.stringify(row)).join("\n");
  return new Response(lines, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "content-disposition": `attachment; filename="audit-webhook-deliveries-${Date.now()}.ndjson"`,
      "x-request-id": requestId,
      "x-audit-checksum": checksum,
      "x-audit-ledger-id": ledger.id,
      "x-audit-ledger-hash": ledger.entry_hash,
    },
  });
}
