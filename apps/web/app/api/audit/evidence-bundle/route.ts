import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { computeAuditChecksum } from "@/lib/audit/checksum";
import { signEvidenceManifest, computeManifestHash } from "@/lib/audit/evidence-signature";
import { fetchAuditExportRows } from "@/lib/audit/export-data";
import { createAuditExportLedgerEntry } from "@/lib/audit/export-ledger";
import { verifyAuditExportToken } from "@/lib/audit/export-token";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");
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
  const limit = Math.min(5000, Math.max(1, Math.trunc(verified.limit)));
  const rows = await fetchAuditExportRows({
    workspaceId: auth.workspaceId,
    exportType: verified.exportType,
    before: safeCutoff,
    limit,
  });
  const checksum = computeAuditChecksum({
    workspaceId: auth.workspaceId,
    type: verified.exportType,
    before: safeCutoff?.toISOString(),
    rows,
  });
  const ledger = await createAuditExportLedgerEntry({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    exportType: verified.exportType,
    beforeAt: safeCutoff,
    exportLimit: limit,
    rowCount: rows.length,
    checksum,
    metadata: {
      bundle: true,
      tokenActorUserId: verified.actorUserId,
    },
  });

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: { audit_export_token_ttl_minutes: true },
  });
  const ttlMinutes = Math.max(1, Math.trunc(workspace?.audit_export_token_ttl_minutes ?? 15));
  const generatedAt = new Date().toISOString();
  const manifest = {
    workspaceId: auth.workspaceId,
    exportType: verified.exportType,
    generatedAt,
    before: safeCutoff?.toISOString() ?? null,
    limit,
    rowCount: rows.length,
    checksum,
    ledger: {
      id: ledger.id,
      entryHash: ledger.entry_hash,
      previousEntryHash: ledger.previous_entry_hash,
      createdAt: ledger.created_at,
    },
  };
  const manifestHash = computeManifestHash(manifest);
  const signatureToken = await signEvidenceManifest({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    manifestHash,
    ledgerEntryHash: ledger.entry_hash,
    expiresInSeconds: ttlMinutes * 60,
  });

  return jsonWithRequestId(request, {
    manifest,
    manifestHash,
    signatureToken,
    rows,
  });
}
