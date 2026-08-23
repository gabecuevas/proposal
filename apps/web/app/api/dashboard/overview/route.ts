import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { bucketWeekly, weekStarts } from "@/lib/dashboard/series";
import type {
  DashboardActivityKind,
  DashboardOverview,
  DashboardStat,
} from "@/lib/dashboard/types";
import { calculateQuoteTotals } from "@/lib/editor/quote";
import type { EditorDoc, PricingModel } from "@/lib/editor/types";
import { documentTitleFromEditorJson } from "@/lib/ui/document-title";

const IN_PROGRESS = ["SENT", "VIEWED", "COMMENTED"] as const;
const ACCEPTED = ["SIGNED", "PAID"] as const;
const DECLINED = ["VOID", "EXPIRED"] as const;

const ACTIVITY_LIMIT = 12;
const DEFAULT_WEEKS = 122;

const activityKindByEvent: Record<string, DashboardActivityKind> = {
  DOCUMENT_VIEWED: "View",
  DOCUMENT_SENT: "Sent",
  DOCUMENT_FINALIZED: "Signed",
  SIGNER_FIELD_UPDATED: "Signed",
  DOCUMENT_PAID: "Paid",
  DOCUMENT_PAYMENT_CHECKOUT_CREATED: "Paid",
  DOCUMENT_COMMENTED: "Comment",
  CPQ_APPROVAL_REQUESTED: "Approval",
};

function parseWeeks(raw: string | null): number {
  const value = Number(raw ?? DEFAULT_WEEKS);
  if (!Number.isFinite(value)) {
    return DEFAULT_WEEKS;
  }
  return Math.min(260, Math.max(4, Math.trunc(value)));
}

function documentValue(pricing: unknown): number {
  if (!pricing || typeof pricing !== "object" || !Array.isArray((pricing as PricingModel).items)) {
    return 0;
  }
  try {
    return calculateQuoteTotals(pricing as PricingModel).totalDueNow;
  } catch {
    return 0;
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const weeks = parseWeeks(new URL(request.url).searchParams.get("weeks"));
  const since = weekStarts(weeks)[0]!;

  const [documents, deliveryEvents, viewEvents, activityEvents, teamMemberCount] =
    await Promise.all([
      prisma.document.findMany({
        where: { workspace_id: auth.workspaceId },
        select: { status: true, pricing_json: true },
      }),
      prisma.documentActivityEvent.findMany({
        where: {
          workspace_id: auth.workspaceId,
          event_type: "DOCUMENT_SENT",
          created_at: { gte: since },
        },
        select: { created_at: true },
      }),
      prisma.documentActivityEvent.findMany({
        where: {
          workspace_id: auth.workspaceId,
          event_type: "DOCUMENT_VIEWED",
          created_at: { gte: since },
        },
        select: { created_at: true },
      }),
      prisma.documentActivityEvent.findMany({
        where: { workspace_id: auth.workspaceId },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          event_type: true,
          created_at: true,
          document_id: true,
          actor_user_id: true,
          actor_recipient_id: true,
          document: { select: { id: true, editor_json: true } },
        },
      }),
      prisma.workspaceMember.count({ where: { workspace_id: auth.workspaceId } }),
    ]);

  const actorUserIds = [
    ...new Set(activityEvents.map((event) => event.actor_user_id).filter(Boolean)),
  ] as string[];
  const actorRecipientIds = [
    ...new Set(activityEvents.map((event) => event.actor_recipient_id).filter(Boolean)),
  ] as string[];

  const [actorUsers, actorRecipients] = await Promise.all([
    actorUserIds.length
      ? prisma.user.findMany({
          where: { id: { in: actorUserIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    actorRecipientIds.length
      ? prisma.recipient.findMany({
          where: { id: { in: actorRecipientIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const userNameById = new Map(actorUsers.map((user) => [user.id, user.name || user.email]));
  const recipientNameById = new Map(
    actorRecipients.map((recipient) => [recipient.id, recipient.name || recipient.email]),
  );

  const emptyBucket = (): DashboardStat => ({ count: 0, value: 0 });
  const totals = {
    inProgress: emptyBucket(),
    accepted: emptyBucket(),
    declined: emptyBucket(),
  };

  for (const document of documents) {
    const status = document.status as string;
    const bucket = (IN_PROGRESS as readonly string[]).includes(status)
      ? totals.inProgress
      : (ACCEPTED as readonly string[]).includes(status)
        ? totals.accepted
        : (DECLINED as readonly string[]).includes(status)
          ? totals.declined
          : null;
    if (!bucket) {
      continue;
    }
    bucket.count += 1;
    bucket.value += documentValue(document.pricing_json);
  }

  for (const bucket of Object.values(totals)) {
    bucket.value = roundMoney(bucket.value);
  }

  const overview: DashboardOverview = {
    currency: "USD",
    totals,
    series: {
      deliveries: bucketWeekly(
        deliveryEvents.map((event) => event.created_at),
        weeks,
      ),
      views: bucketWeekly(
        viewEvents.map((event) => event.created_at),
        weeks,
      ),
    },
    activity: activityEvents.map((event) => ({
      id: event.id,
      kind: activityKindByEvent[event.event_type] ?? "Event",
      occurredAt: event.created_at.toISOString(),
      actor:
        (event.actor_user_id ? userNameById.get(event.actor_user_id) : undefined) ??
        (event.actor_recipient_id ? recipientNameById.get(event.actor_recipient_id) : undefined) ??
        "System",
      documentId: event.document_id,
      documentTitle: documentTitleFromEditorJson(
        event.document?.editor_json as EditorDoc | null,
        event.document?.id ?? event.document_id,
      ),
    })),
    teamMemberCount,
  };

  return jsonWithRequestId(request, { overview });
}
