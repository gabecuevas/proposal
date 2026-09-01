import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";
import type { InputJsonValue as PrismaInputJsonValue } from "@prisma/client/runtime/library";

function readPrismaClientVersion(): string {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    return readFileSync(join(dir, ".prisma-client-version"), "utf8").trim();
  } catch {
    return "0";
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientVersion?: string;
};

const prismaClientVersion = readPrismaClientVersion();
if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prismaClientVersion !== prismaClientVersion
) {
  void globalForPrisma.prisma?.$disconnect();
  globalForPrisma.prisma = new PrismaClient();
  globalForPrisma.prismaClientVersion = prismaClientVersion;
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClientVersion = prismaClientVersion;
}

export { Prisma };
export type {
  CrmActivityAvailability,
  CrmActivityPriority,
  CrmActivityType,
  CrmTimelineEventType,
} from "@prisma/client";

export type InputJsonValue = PrismaInputJsonValue;
