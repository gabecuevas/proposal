type LogLevel = "info" | "warn" | "error";

export function logWorkerEvent(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    service: "worker",
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
