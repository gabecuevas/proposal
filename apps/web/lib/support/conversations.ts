import {
  Prisma,
  prisma,
  type SupportConversation,
  type SupportMessage,
  type SupportMessageVisibility,
  type SupportConversationStatus,
  type SupportConversationPriority,
} from "@repo/db";
import { isSupportEmailEnabled, supportEmailDelaySeconds } from "@/lib/support/flags";

function stripPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

function serializeMessage(message: SupportMessage, viewer: "admin" | "customer") {
  if (viewer === "customer" && message.visibility === "INTERNAL") {
    return null;
  }
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderUserId: message.sender_user_id,
    visibility: message.visibility,
    source: message.source,
    bodyHtml: message.body_html,
    bodyText: message.body_text,
    clientOpId: message.client_op_id,
    sequence: message.sequence,
    createdAt: message.created_at.toISOString(),
  };
}

function serializeConversation(
  row: SupportConversation & {
    customer?: { id: string; email: string; name: string } | null;
    messages?: SupportMessage[];
  },
  viewer: "admin" | "customer",
) {
  const messages =
    row.messages
      ?.map((m) => serializeMessage(m, viewer))
      .filter((m): m is NonNullable<typeof m> => m !== null) ?? undefined;

  return {
    id: row.id,
    customerUserId: row.customer_user_id,
    workspaceId: row.workspace_id,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    assigneeAdminId: row.assignee_admin_id,
    source: row.source,
    lastMessageAt: row.last_message_at.toISOString(),
    lastPublicPreview: row.last_public_preview,
    customerUnreadCount: row.customer_unread_count,
    adminUnreadCount: row.admin_unread_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    customer: row.customer
      ? { id: row.customer.id, email: row.customer.email, name: row.customer.name }
      : undefined,
    messages,
  };
}

async function scheduleUnreadNotifyJob(
  tx: Prisma.TransactionClient,
  input: { conversationId: string; messageId: string; customerUserId: string; messageSequence: number },
) {
  if (!isSupportEmailEnabled()) {
    return;
  }
  const delayMs = supportEmailDelaySeconds() * 1000;
  const runAfter = new Date(Date.now() + delayMs);
  try {
    await tx.supportJob.create({
      data: {
        type: "support.notify_unread",
        payload_json: {
          conversationId: input.conversationId,
          messageId: input.messageId,
          customerUserId: input.customerUserId,
          messageSequence: input.messageSequence,
        },
        run_after: runAfter,
        idempotency_key: `notify_unread:${input.messageId}`,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    throw error;
  }
}

async function nextSequence(
  tx: Prisma.TransactionClient,
  conversationId: string,
): Promise<number> {
  const agg = await tx.supportMessage.aggregate({
    where: { conversation_id: conversationId },
    _max: { sequence: true },
  });
  return (agg._max.sequence ?? 0) + 1;
}

export async function createConversation(input: {
  customerUserId: string;
  workspaceId?: string | null;
  subject: string;
  initialBody?: string;
  senderUserId?: string;
  clientOpId?: string;
  source?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.create({
      data: {
        customer_user_id: input.customerUserId,
        workspace_id: input.workspaceId ?? null,
        subject: input.subject.trim() || "Support request",
        source: input.source ?? "messenger",
        last_public_preview: input.initialBody ? stripPreview(input.initialBody) : null,
      },
      include: { customer: { select: { id: true, email: true, name: true } } },
    });

    if (input.initialBody?.trim()) {
      const senderId = input.senderUserId ?? input.customerUserId;
      const sequence = 1;
      const message = await tx.supportMessage.create({
        data: {
          conversation_id: conversation.id,
          sender_user_id: senderId,
          visibility: "PUBLIC",
          source: "IN_APP",
          body_html: `<p>${escapeHtml(input.initialBody.trim())}</p>`,
          body_text: input.initialBody.trim(),
          client_op_id: input.clientOpId ?? null,
          sequence,
        },
      });
      await tx.supportConversation.update({
        where: { id: conversation.id },
        data: {
          admin_unread_count: senderId === input.customerUserId ? 1 : 0,
          customer_unread_count: senderId === input.customerUserId ? 0 : 1,
          last_message_at: message.created_at,
        },
      });
      if (senderId !== input.customerUserId && isSupportEmailEnabled()) {
        await scheduleUnreadNotifyJob(tx, {
          conversationId: conversation.id,
          messageId: message.id,
          customerUserId: input.customerUserId,
          messageSequence: sequence,
        });
      }
    }

    const full = await tx.supportConversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: { customer: { select: { id: true, email: true, name: true } } },
    });
    return serializeConversation(full, "admin");
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function listAdminConversations(query: {
  status?: SupportConversationStatus;
  assigneeAdminId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, query.pageSize ?? 25));
  const where: Prisma.SupportConversationWhereInput = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.assigneeAdminId !== undefined) {
    where.assignee_admin_id = query.assigneeAdminId;
  }
  if (query.search?.trim()) {
    const q = query.search.trim();
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { customer: { email: { contains: q, mode: "insensitive" } } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.supportConversation.count({ where }),
    prisma.supportConversation.findMany({
      where,
      orderBy: { last_message_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: { select: { id: true, email: true, name: true } } },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    conversations: rows.map((r) => serializeConversation(r, "admin")),
  };
}

export async function listCustomerConversations(customerUserId: string) {
  const rows = await prisma.supportConversation.findMany({
    where: { customer_user_id: customerUserId },
    orderBy: { last_message_at: "desc" },
    include: { customer: { select: { id: true, email: true, name: true } } },
  });
  return rows.map((r) => serializeConversation(r, "customer"));
}

export async function getConversationForAdmin(conversationId: string) {
  const row = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: { select: { id: true, email: true, name: true } },
      messages: { orderBy: { sequence: "asc" } },
    },
  });
  if (!row) {
    return null;
  }
  return serializeConversation(row, "admin");
}

export async function getConversationForCustomer(conversationId: string, customerUserId: string) {
  const row = await prisma.supportConversation.findFirst({
    where: { id: conversationId, customer_user_id: customerUserId },
    include: {
      customer: { select: { id: true, email: true, name: true } },
      messages: {
        where: { visibility: "PUBLIC" },
        orderBy: { sequence: "asc" },
      },
    },
  });
  if (!row) {
    return null;
  }
  return serializeConversation(row, "customer");
}

async function findIdempotentMessage(senderUserId: string, clientOpId: string) {
  return prisma.supportMessage.findUnique({
    where: {
      sender_user_id_client_op_id: {
        sender_user_id: senderUserId,
        client_op_id: clientOpId,
      },
    },
  });
}

async function appendMessage(input: {
  conversationId: string;
  senderUserId: string;
  bodyHtml: string;
  bodyText: string;
  visibility: SupportMessageVisibility;
  clientOpId?: string | null;
  fromAdmin: boolean;
  source?: "IN_APP" | "EMAIL" | "SYSTEM";
  emailMessageId?: string | null;
  providerEmailId?: string | null;
}) {
  if (input.clientOpId) {
    const existing = await findIdempotentMessage(input.senderUserId, input.clientOpId);
    if (existing) {
      return existing;
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.clientOpId) {
      const existing = await tx.supportMessage.findUnique({
        where: {
          sender_user_id_client_op_id: {
            sender_user_id: input.senderUserId,
            client_op_id: input.clientOpId,
          },
        },
      });
      if (existing) {
        return existing;
      }
    }

    const conversation = await tx.supportConversation.findUniqueOrThrow({
      where: { id: input.conversationId },
    });

    const sequence = await nextSequence(tx, input.conversationId);
    const message = await tx.supportMessage.create({
      data: {
        conversation_id: input.conversationId,
        sender_user_id: input.senderUserId,
        visibility: input.visibility,
        source: input.source ?? "IN_APP",
        body_html: input.bodyHtml,
        body_text: input.bodyText,
        client_op_id: input.clientOpId ?? null,
        sequence,
        email_message_id: input.emailMessageId ?? null,
        provider_email_id: input.providerEmailId ?? null,
      },
    });

    const preview =
      input.visibility === "PUBLIC" ? stripPreview(input.bodyText) : conversation.last_public_preview;
    const unreadPatch =
      input.visibility === "PUBLIC"
        ? input.fromAdmin
          ? { customer_unread_count: { increment: 1 } }
          : { admin_unread_count: { increment: 1 } }
        : {};

    await tx.supportConversation.update({
      where: { id: input.conversationId },
      data: {
        last_message_at: message.created_at,
        ...(input.visibility === "PUBLIC"
          ? {
              last_public_preview: preview,
              // Customer reply reopens resolved threads; admin public reply waits on customer.
              status: input.fromAdmin ? "WAITING_ON_CUSTOMER" : "OPEN",
            }
          : {}),
        ...unreadPatch,
      },
    });

    if (input.fromAdmin && input.visibility === "PUBLIC") {
      await scheduleUnreadNotifyJob(tx, {
        conversationId: input.conversationId,
        messageId: message.id,
        customerUserId: conversation.customer_user_id,
        messageSequence: sequence,
      });
    }

    return message;
  });
}

export async function postPublicMessage(input: {
  conversationId: string;
  senderUserId: string;
  bodyText: string;
  clientOpId?: string;
  fromAdmin: boolean;
  source?: "IN_APP" | "EMAIL" | "SYSTEM";
  emailMessageId?: string | null;
  providerEmailId?: string | null;
}) {
  const text = input.bodyText.trim();
  if (!text) {
    throw new Error("empty_body");
  }
  const html = `<p>${escapeHtml(text)}</p>`;
  const message = await appendMessage({
    conversationId: input.conversationId,
    senderUserId: input.senderUserId,
    bodyHtml: html,
    bodyText: text,
    visibility: "PUBLIC",
    clientOpId: input.clientOpId,
    fromAdmin: input.fromAdmin,
    source: input.source,
    emailMessageId: input.emailMessageId,
    providerEmailId: input.providerEmailId,
  });
  return serializeMessage(message, input.fromAdmin ? "admin" : "customer")!;
}

export async function postInternalNote(input: {
  conversationId: string;
  adminUserId: string;
  bodyText: string;
  clientOpId?: string;
}) {
  const text = input.bodyText.trim();
  if (!text) {
    throw new Error("empty_body");
  }
  const message = await appendMessage({
    conversationId: input.conversationId,
    senderUserId: input.adminUserId,
    bodyHtml: `<p><em>Internal note</em></p><p>${escapeHtml(text)}</p>`,
    bodyText: text,
    visibility: "INTERNAL",
    clientOpId: input.clientOpId,
    fromAdmin: true,
  });
  return serializeMessage(message, "admin")!;
}

export async function assignConversation(conversationId: string, assigneeAdminId: string | null) {
  const row = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: { assignee_admin_id: assigneeAdminId },
    include: { customer: { select: { id: true, email: true, name: true } } },
  });
  return serializeConversation(row, "admin");
}

export async function resolveConversation(conversationId: string) {
  const row = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: { status: "RESOLVED" },
    include: { customer: { select: { id: true, email: true, name: true } } },
  });
  return serializeConversation(row, "admin");
}

export async function reopenConversation(conversationId: string) {
  const row = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: { status: "OPEN" },
    include: { customer: { select: { id: true, email: true, name: true } } },
  });
  return serializeConversation(row, "admin");
}

export async function setConversationPriority(
  conversationId: string,
  priority: SupportConversationPriority,
) {
  const row = await prisma.supportConversation.update({
    where: { id: conversationId },
    data: { priority },
    include: { customer: { select: { id: true, email: true, name: true } } },
  });
  return serializeConversation(row, "admin");
}

export async function markRead(input: {
  userId: string;
  conversationId: string;
  sequence: number;
  role: "admin" | "customer";
}) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: input.conversationId },
  });
  if (!conversation) {
    return null;
  }

  const existing = await prisma.supportReadState.findUnique({
    where: {
      conversation_id_user_id: {
        conversation_id: input.conversationId,
        user_id: input.userId,
      },
    },
  });
  const nextSequence = Math.max(existing?.last_read_sequence ?? 0, input.sequence);
  await prisma.supportReadState.upsert({
    where: {
      conversation_id_user_id: {
        conversation_id: input.conversationId,
        user_id: input.userId,
      },
    },
    create: {
      conversation_id: input.conversationId,
      user_id: input.userId,
      last_read_sequence: nextSequence,
    },
    update: {
      last_read_sequence: nextSequence,
    },
  });

  const unreadWhere: Prisma.SupportMessageWhereInput = {
    conversation_id: input.conversationId,
    visibility: "PUBLIC",
    sequence: { gt: nextSequence },
  };

  if (input.role === "admin") {
    unreadWhere.sender_user_id = conversation.customer_user_id;
  } else {
    unreadWhere.NOT = { sender_user_id: conversation.customer_user_id };
  }

  const unread = await prisma.supportMessage.count({ where: unreadWhere });

  await prisma.supportConversation.update({
    where: { id: input.conversationId },
    data:
      input.role === "admin"
        ? { admin_unread_count: unread }
        : { customer_unread_count: unread },
  });

  return { lastReadSequence: nextSequence, unreadCount: unread };
}

export async function customerUnreadTotal(userId: string): Promise<number> {
  const agg = await prisma.supportConversation.aggregate({
    where: { customer_user_id: userId },
    _sum: { customer_unread_count: true },
  });
  return agg._sum.customer_unread_count ?? 0;
}
