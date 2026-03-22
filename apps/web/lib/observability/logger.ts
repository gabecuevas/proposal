import type { NextRequest } from "next/server";

type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: "web",
    event,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function logApiEvent(
  request: NextRequest | Request,
  input: {
    level?: LogLevel;
    event: string;
    requestId: string;
    status?: number;
    workspaceId?: string;
    userId?: string;
    details?: Record<string, unknown>;
  },
) {
  const url = new URL(request.url);
  write(input.level ?? "info", input.event, {
    requestId: input.requestId,
    method: request.method,
    path: url.pathname,
    status: input.status,
    workspaceId: input.workspaceId,
    userId: input.userId,
    ...(input.details ?? {}),
  });
}
