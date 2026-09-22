import { prisma } from "@repo/db";
import type { PricingModel } from "@/lib/editor/types";

export const MIN_CPQ_APPROVAL_THRESHOLD = 0;
export const MAX_CPQ_APPROVAL_THRESHOLD = 100;

export function getDiscountPercent(pricing: PricingModel | Record<string, unknown>): number {
  if (pricing && typeof pricing === "object" && (pricing as { schema?: string }).schema === "commercial_v1") {
    const discount = (pricing as { discount?: { enabled?: boolean; mode?: string; valueScaled?: number } }).discount;
    if (!discount?.enabled) {
      return 0;
    }
    if (discount.mode === "percent") {
      const raw = Number(discount.valueScaled ?? 0) / 100;
      return Number.isFinite(raw) ? Math.max(0, raw) : 0;
    }
    return 0;
  }
  const raw = Number((pricing as PricingModel).discountPercent ?? 0);
  if (!Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, raw);
}

export function requiresQuoteApproval(input: {
  discountPercent: number;
  thresholdPercent: number;
}): boolean {
  return input.discountPercent > input.thresholdPercent;
}

export async function getWorkspaceCpqPolicy(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      cpq_approval_discount_threshold: true,
    },
  });
  return {
    discountApprovalThreshold:
      workspace?.cpq_approval_discount_threshold ?? MAX_CPQ_APPROVAL_THRESHOLD,
  };
}
