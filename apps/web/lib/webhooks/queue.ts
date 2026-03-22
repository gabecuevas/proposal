import { Queue, type ConnectionOptions } from "bullmq";
import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";
import type { WebhookDeliveryJobPayload } from "@repo/shared";

const WEBHOOK_QUEUE_NAME = "webhook-delivery-jobs";

function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const parsed = new URL(redisUrl);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
  };
}

function endpointSubscribesToEvent(eventsJson: unknown, eventType: string): boolean {
  if (!Array.isArray(eventsJson)) {
    return false;
  }
  return eventsJson.includes(eventType) || eventsJson.includes("*");
}

export async function enqueueWebhookEvent(input: {
  workspaceId: string;
  eventType: string;
  documentId?: string;
  actorUserId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      workspace_id: input.workspaceId,
      is_active: true,
    },
  });
  const matchedEndpoints = endpoints.filter((endpoint) =>
    endpointSubscribesToEvent(endpoint.events_json, input.eventType),
  );
  if (matchedEndpoints.length === 0) {
    return 0;
  }

  const createdDeliveries = await prisma.$transaction(async (tx) => {
    const deliveries = [];
    for (const endpoint of matchedEndpoints) {
      const delivery = await tx.webhookDelivery.create({
        data: {
          workspace_id: input.workspaceId,
          endpoint_id: endpoint.id,
          document_id: input.documentId ?? null,
          event_type: input.eventType,
          status: "PENDING",
          attempts: 0,
          payload_json: input.payload as InputJsonValue,
        },
      });
      deliveries.push(delivery);
    }

    if (input.documentId) {
      await tx.documentActivityEvent.create({
        data: {
          workspace_id: input.workspaceId,
          document_id: input.documentId,
          event_type: "WEBHOOK_DELIVERY_ENQUEUED",
          actor_user_id: input.actorUserId,
          metadata_json: {
            eventType: input.eventType,
            deliveryCount: deliveries.length,
            correlationId: input.correlationId,
          },
        },
      });
    }
    return deliveries;
  });

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const queue = new Queue(WEBHOOK_QUEUE_NAME, { connection: parseRedisConnection(redisUrl) });
  try {
    for (const delivery of createdDeliveries) {
      const payload: WebhookDeliveryJobPayload = {
        deliveryId: delivery.id,
        correlationId: input.correlationId,
      };
      await queue.add("deliver-webhook", payload, {
        jobId: `webhook-delivery:${delivery.id}`,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      });
    }
  } finally {
    await queue.close();
  }

  return createdDeliveries.length;
}

export async function replayWebhookDelivery(input: {
  deliveryId: string;
  workspaceId: string;
  actorUserId: string;
  correlationId?: string;
}): Promise<string> {
  const delivery = await prisma.webhookDelivery.findFirst({
    where: {
      id: input.deliveryId,
      workspace_id: input.workspaceId,
    },
  });
  if (!delivery) {
    throw new Error("Webhook delivery not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.webhookDelivery.update({
      where: { id: input.deliveryId },
      data: {
        status: "PENDING",
        attempts: 0,
        signature: null,
        http_status: null,
        response_body: null,
        next_retry_at: null,
        delivered_at: null,
      },
    });

    if (delivery.document_id) {
      await tx.documentActivityEvent.create({
        data: {
          workspace_id: input.workspaceId,
          document_id: delivery.document_id,
          event_type: "WEBHOOK_DELIVERY_REPLAY_ENQUEUED",
          actor_user_id: input.actorUserId,
          metadata_json: {
            deliveryId: input.deliveryId,
            eventType: delivery.event_type,
            correlationId: input.correlationId,
          },
        },
      });
    }
  });

  const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
  const queue = new Queue(WEBHOOK_QUEUE_NAME, { connection: parseRedisConnection(redisUrl) });
  const replayJobId = `webhook-delivery:replay:${input.deliveryId}:${Date.now()}`;
  try {
    const payload: WebhookDeliveryJobPayload = {
      deliveryId: input.deliveryId,
      correlationId: input.correlationId,
    };
    const job = await queue.add("deliver-webhook", payload, {
      jobId: replayJobId,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
    return job.id ?? replayJobId;
  } finally {
    await queue.close();
  }
}
