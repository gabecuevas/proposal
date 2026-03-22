import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";
import { stableStringify } from "./checksum";

export async function createAuditExportLedgerEntry(input: {
  workspaceId: string;
  actorUserId: string;
  exportType: string;
  beforeAt?: Date;
  exportLimit: number;
  rowCount: number;
  checksum: string;
  metadata?: Record<string, unknown>;
}) {
  const previous = await prisma.auditExportLedger.findFirst({
    where: {
      workspace_id: input.workspaceId,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    select: {
      id: true,
      entry_hash: true,
    },
  });
  const payload = {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    exportType: input.exportType,
    beforeAt: input.beforeAt?.toISOString() ?? null,
    exportLimit: input.exportLimit,
    rowCount: input.rowCount,
    checksum: input.checksum,
    previousEntryHash: previous?.entry_hash ?? null,
    metadata: input.metadata ?? {},
  };
  const entryHash = createHash("sha256").update(stableStringify(payload)).digest("hex");
  return prisma.auditExportLedger.create({
    data: {
      workspace_id: input.workspaceId,
      actor_user_id: input.actorUserId,
      export_type: input.exportType,
      before_at: input.beforeAt ?? null,
      export_limit: input.exportLimit,
      row_count: input.rowCount,
      checksum: input.checksum,
      previous_entry_hash: previous?.entry_hash ?? null,
      entry_hash: entryHash,
      metadata_json: (input.metadata ?? {}) as InputJsonValue,
    },
  });
}
