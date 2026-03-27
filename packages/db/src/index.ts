import { PrismaClient, Prisma } from "@prisma/client";
import type { InputJsonValue as PrismaInputJsonValue } from "@prisma/client/runtime/library";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type InputJsonValue = PrismaInputJsonValue;