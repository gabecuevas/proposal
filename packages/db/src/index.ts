import { PrismaClient, Prisma } from "@prisma/client";
import type { InputJsonValue as PrismaInputJsonValue } from "@prisma/client/runtime/library";

/**
 * Bump when adding/removing Prisma model fields so hot-reload drops a stale
 * PrismaClient that would reject new columns (e.g. Company.linkedin).
 */
const PRISMA_SCHEMA_REV = 22;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaRev?: number;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

/** Stale hot-reload clients can miss newly generated delegates. */
function clientLooksCurrent(client: PrismaClient): boolean {
  const record = client as unknown as Record<string, unknown>;
  return (
    typeof record.crmEmailAccount === "object" &&
    typeof record.crmEmailMessage === "object" &&
    typeof record.crmEmailTemplate === "object" &&
    typeof record.crmEmailSignature === "object" &&
    typeof record.crmCalendarAccount === "object" &&
    typeof record.crmCalendarEvent === "object"
  );
}

function getPrismaClient(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaSchemaRev === PRISMA_SCHEMA_REV &&
    clientLooksCurrent(globalForPrisma.prisma)
  ) {
    return globalForPrisma.prisma;
  }
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaSchemaRev = undefined;
  }
  const next = createPrismaClient();
  globalForPrisma.prisma = next;
  globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
  return next;
}

/**
 * Always resolve through getPrismaClient so hot-reload / schema bumps pick up
 * new model delegates instead of holding a stale singleton.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    // Use the real client as Reflect receiver so Prisma getters keep `this`.
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** True when the generated client includes the given model delegate. */
export function prismaHasModel(model: keyof PrismaClient): boolean {
  const client = getPrismaClient();
  const value = Reflect.get(client, model as string | symbol, client);
  return typeof value === "object" && value !== null;
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = getPrismaClient();
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
  CrmEmailTemplateVisibility,
  CrmTimelineEventType,
} from "@prisma/client";

export type InputJsonValue = PrismaInputJsonValue;
