import { Prisma, prisma, type InAppCampaignStatus } from "@repo/db";
import {
  evaluateAudienceUsers,
  parseAudienceFilters,
  summarizeAudience,
} from "@/lib/support/audience";
import { isSupportCampaignsEnabled } from "@/lib/support/flags";

export async function listCampaigns(status?: InAppCampaignStatus) {
  const where: Prisma.InAppCampaignWhereInput = status ? { status } : {};
  const rows = await prisma.inAppCampaign.findMany({
    where,
    orderBy: { updated_at: "desc" },
    include: {
      _count: { select: { deliveries: true } },
    },
  });
  return Promise.all(
    rows.map(async (row) => {
      const metrics = await campaignMetrics(row.id);
      return {
        ...serializeCampaign(row),
        audienceSummary: summarizeAudience(row.filters_json),
        delivered: metrics.delivered,
        viewed: metrics.viewed,
        clicked: metrics.clicked,
        replied: metrics.replied,
      };
    }),
  );
}

function serializeCampaign(row: {
  id: string;
  title: string;
  status: InAppCampaignStatus;
  body_html: string;
  body_text: string;
  cta_label: string | null;
  cta_url: string | null;
  filters_json: unknown;
  delivery_mode: string;
  starts_at: Date | null;
  ends_at: Date | null;
  published_version: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    filtersJson: row.filters_json,
    deliveryMode: row.delivery_mode,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    publishedVersion: row.published_version,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    audienceSummary: summarizeAudience(row.filters_json),
  };
}

async function campaignMetrics(campaignId: string) {
  const [delivered, viewed, clicked, replied] = await Promise.all([
    prisma.campaignDelivery.count({ where: { campaign_id: campaignId } }),
    prisma.campaignDelivery.count({ where: { campaign_id: campaignId, viewed_at: { not: null } } }),
    prisma.campaignDelivery.count({ where: { campaign_id: campaignId, clicked_at: { not: null } } }),
    prisma.campaignDelivery.count({ where: { campaign_id: campaignId, replied_at: { not: null } } }),
  ]);
  return { delivered, viewed, clicked, replied };
}

export async function getCampaign(id: string) {
  const row = await prisma.inAppCampaign.findUnique({ where: { id } });
  if (!row) {
    return null;
  }
  const metrics = await campaignMetrics(id);
  return { ...serializeCampaign(row), ...metrics };
}

export async function createCampaign(input: {
  title: string;
  bodyHtml: string;
  bodyText: string;
  createdBy: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  filtersJson?: unknown;
  deliveryMode?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const filters = parseAudienceFilters(input.filtersJson);
  const row = await prisma.inAppCampaign.create({
    data: {
      title: input.title.trim(),
      body_html: input.bodyHtml,
      body_text: input.bodyText,
      cta_label: input.ctaLabel ?? null,
      cta_url: input.ctaUrl ?? null,
      filters_json: filters as unknown as Prisma.InputJsonValue,
      delivery_mode: input.deliveryMode ?? "ongoing",
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      created_by: input.createdBy,
    },
  });
  return serializeCampaign(row);
}

export async function updateCampaign(
  id: string,
  input: Partial<{
    title: string;
    bodyHtml: string;
    bodyText: string;
    ctaLabel: string | null;
    ctaUrl: string | null;
    filtersJson: unknown;
    deliveryMode: string;
    startsAt: Date | null;
    endsAt: Date | null;
  }>,
) {
  const row = await prisma.inAppCampaign.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.bodyHtml !== undefined ? { body_html: input.bodyHtml } : {}),
      ...(input.bodyText !== undefined ? { body_text: input.bodyText } : {}),
      ...(input.ctaLabel !== undefined ? { cta_label: input.ctaLabel } : {}),
      ...(input.ctaUrl !== undefined ? { cta_url: input.ctaUrl } : {}),
      ...(input.filtersJson !== undefined
        ? { filters_json: parseAudienceFilters(input.filtersJson) as unknown as Prisma.InputJsonValue }
        : {}),
      ...(input.deliveryMode !== undefined ? { delivery_mode: input.deliveryMode } : {}),
      ...(input.startsAt !== undefined ? { starts_at: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}),
    },
  });
  return serializeCampaign(row);
}

export async function publishCampaign(id: string) {
  if (!isSupportCampaignsEnabled()) {
    throw new Error("campaigns_disabled");
  }
  const existing = await prisma.inAppCampaign.findUniqueOrThrow({ where: { id } });
  const now = new Date();
  const startsAt = existing.starts_at;
  const nextStatus: InAppCampaignStatus =
    startsAt && startsAt.getTime() > now.getTime() ? "SCHEDULED" : "LIVE";

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.inAppCampaign.update({
      where: { id },
      data: {
        status: nextStatus,
        published_version: existing.published_version + 1,
        snapshot_json: {
          title: existing.title,
          bodyHtml: existing.body_html,
          bodyText: existing.body_text,
          ctaLabel: existing.cta_label,
          ctaUrl: existing.cta_url,
          filtersJson: existing.filters_json,
          deliveryMode: existing.delivery_mode,
          version: existing.published_version + 1,
        } as Prisma.InputJsonValue,
      },
    });

    if (nextStatus === "LIVE") {
      await tx.supportJob.create({
        data: {
          type: "support.campaign_deliver_batch",
          payload_json: { campaignId: id, cursorUserId: null },
          idempotency_key: `campaign_deliver:${id}:v${updated.published_version}:start`,
        },
      });
    } else {
      await tx.supportJob.create({
        data: {
          type: "support.campaign_deliver_batch",
          payload_json: { campaignId: id, cursorUserId: null },
          run_after: startsAt!,
          idempotency_key: `campaign_deliver:${id}:v${updated.published_version}:start`,
        },
      });
    }

    await tx.supportAuditEvent.create({
      data: {
        actor_user_id: existing.created_by,
        action: "campaign.publish",
        target_type: "InAppCampaign",
        target_id: id,
        metadata_json: { status: nextStatus, version: updated.published_version },
      },
    });

    return updated;
  });

  return serializeCampaign(row);
}

export async function pauseCampaign(id: string) {
  const row = await prisma.inAppCampaign.update({
    where: { id },
    data: { status: "PAUSED" },
  });
  return serializeCampaign(row);
}

/**
 * Deliver one bounded batch of campaign messages. Resumes via cursor.
 * Idempotent per (campaign_id, user_id, campaign_version).
 */
export async function deliverCampaignBatch(campaignId: string, cursorUserId: string | null) {
  if (!isSupportCampaignsEnabled()) {
    return { delivered: 0, done: true };
  }

  const campaign = await prisma.inAppCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "LIVE") {
    return { delivered: 0, done: true };
  }
  if (campaign.ends_at && campaign.ends_at.getTime() < Date.now()) {
    await prisma.inAppCampaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED" },
    });
    return { delivered: 0, done: true };
  }

  const { matches, nextCursor } = await evaluateAudienceUsers(campaign.filters_json, {
    limit: 50,
    cursorUserId: cursorUserId ?? undefined,
  });

  let delivered = 0;
  for (const match of matches) {
    try {
      await prisma.campaignDelivery.create({
        data: {
          campaign_id: campaignId,
          user_id: match.userId,
          workspace_id: match.workspaceId,
          campaign_version: campaign.published_version,
        },
      });
      delivered += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  if (nextCursor) {
    await prisma.supportJob.create({
      data: {
        type: "support.campaign_deliver_batch",
        payload_json: { campaignId, cursorUserId: nextCursor },
        idempotency_key: `campaign_deliver:${campaignId}:v${campaign.published_version}:${nextCursor}`,
      },
    });
  } else if (campaign.delivery_mode === "one_time") {
    await prisma.inAppCampaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED" },
    });
  }

  return { delivered, done: !nextCursor };
}

/** Ongoing campaigns: evaluate newly eligible users without re-delivering prior recipients. */
export async function evaluateOngoingCampaigns() {
  if (!isSupportCampaignsEnabled()) {
    return { enqueued: 0 };
  }
  const live = await prisma.inAppCampaign.findMany({
    where: {
      status: "LIVE",
      delivery_mode: "ongoing",
      OR: [{ ends_at: null }, { ends_at: { gt: new Date() } }],
    },
    take: 20,
  });
  let enqueued = 0;
  for (const campaign of live) {
    try {
      await prisma.supportJob.create({
        data: {
          type: "support.campaign_deliver_batch",
          payload_json: { campaignId: campaign.id, cursorUserId: null },
          idempotency_key: `campaign_ongoing:${campaign.id}:${new Date().toISOString().slice(0, 13)}`,
        },
      });
      enqueued += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }
  return { enqueued };
}

export async function listUserCampaignDeliveries(userId: string) {
  const rows = await prisma.campaignDelivery.findMany({
    where: { user_id: userId },
    orderBy: { delivered_at: "desc" },
    take: 50,
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          body_text: true,
          body_html: true,
          cta_label: true,
          cta_url: true,
          status: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    title: row.campaign.title,
    bodyText: row.campaign.body_text,
    bodyHtml: row.campaign.body_html,
    ctaLabel: row.campaign.cta_label,
    ctaUrl: row.campaign.cta_url,
    status: row.campaign.status,
    deliveredAt: row.delivered_at.toISOString(),
    viewedAt: row.viewed_at?.toISOString() ?? null,
    clickedAt: row.clicked_at?.toISOString() ?? null,
  }));
}

export async function markCampaignViewed(deliveryId: string, userId: string) {
  const row = await prisma.campaignDelivery.findFirst({
    where: { id: deliveryId, user_id: userId },
  });
  if (!row) {
    return null;
  }
  if (row.viewed_at) {
    return row;
  }
  return prisma.campaignDelivery.update({
    where: { id: deliveryId },
    data: { viewed_at: new Date() },
  });
}

export async function markCampaignClicked(deliveryId: string, userId: string) {
  const row = await prisma.campaignDelivery.findFirst({
    where: { id: deliveryId, user_id: userId },
  });
  if (!row) {
    return null;
  }
  return prisma.campaignDelivery.update({
    where: { id: deliveryId },
    data: {
      clicked_at: row.clicked_at ?? new Date(),
      viewed_at: row.viewed_at ?? new Date(),
    },
  });
}

export async function previewAudience(filtersJson: unknown) {
  const { matches, totalEstimate } = await evaluateAudienceUsers(filtersJson, { limit: 10 });
  return {
    sample: matches,
    matchingCount: totalEstimate,
    audienceSummary: summarizeAudience(filtersJson),
  };
}
