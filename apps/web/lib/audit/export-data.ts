import { prisma } from "@repo/db";
import type { AuditExportType } from "./export-token";

export async function fetchAuditExportRows(input: {
  workspaceId: string;
  exportType: AuditExportType;
  before?: Date;
  limit: number;
}) {
  if (input.exportType === "activity") {
    const rows = await prisma.documentActivityEvent.findMany({
      where: {
        workspace_id: input.workspaceId,
        created_at: input.before ? { lt: input.before } : undefined,
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: input.limit,
    });
    return rows;
  }
  const rows = await prisma.webhookDelivery.findMany({
    where: {
      workspace_id: input.workspaceId,
      created_at: input.before ? { lt: input.before } : undefined,
    },
    include: {
      endpoint: {
        select: {
          id: true,
          url: true,
          is_active: true,
        },
      },
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: input.limit,
  });
  return rows;
}
