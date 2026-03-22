import net from "node:net";
import { prisma } from "@repo/db";

function parseHostPort(urlValue: string, fallbackPort: number): { host: string; port: number } | null {
  try {
    const parsed = new URL(urlValue);
    return {
      host: parsed.hostname,
      port: Number(parsed.port || fallbackPort),
    };
  } catch {
    return null;
  }
}

function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export async function checkWebReadiness() {
  let dbReady = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }

  let redisReady = false;
  const redisTarget = parseHostPort(process.env.REDIS_URL ?? "", 6379);
  if (redisTarget) {
    redisReady = await checkPort(redisTarget.host, redisTarget.port);
  }

  return {
    dbReady,
    redisReady,
    ready: dbReady && redisReady,
  };
}
