import { PrismaClient, Prisma } from "@prisma/client";
import type { InputJsonValue as PrismaInputJsonValue } from "@prisma/client/runtime/library";

/**
 * Bump when adding/removing Prisma model fields so hot-reload drops a stale
 * PrismaClient that would reject new columns (e.g. Company.linkedin).
 */
const PRISMA_SCHEMA_REV = 10;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaRev?: number;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma && globalForPrisma.prismaSchemaRev === PRISMA_SCHEMA_REV) {
    return globalForPrisma.prisma;
  }
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  }
  globalForPrisma.prisma = createPrismaClient();
  globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
}

export { Prisma };
export type {
  CrmActivityAvailability,
  CrmActivityPriority,
  CrmActivityType,
  CrmEmailFolder,
  CrmEmailDirection,
  CrmEmailSyncProvider,
  CrmEmailSyncStatus,
  CrmTimelineEventType,
} from "@prisma/client";

export type InputJsonValue = PrismaInputJsonValue;
