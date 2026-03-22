#!/usr/bin/env node

import net from "node:net";

const requiredVars = [
  "DATABASE_URL",
  "REDIS_URL",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "S3_ENDPOINT",
  "S3_BUCKET",
];

function parseHostPort(urlValue, fallbackPort) {
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

function checkPort(host, port, label) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeoutMs = 2500;
    let settled = false;

    const finish = (ok, message) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, message: `${label}: ${message}` });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true, `reachable on ${host}:${port}`));
    socket.once("timeout", () => finish(false, `timeout connecting to ${host}:${port}`));
    socket.once("error", (error) => {
      finish(false, `failed (${error.code ?? "unknown error"}) to ${host}:${port}`);
    });
    socket.connect(port, host);
  });
}

async function run() {
  const missingVars = requiredVars.filter((name) => !process.env[name]);
  if (missingVars.length > 0) {
    console.error(`Missing required env vars: ${missingVars.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Environment variables: OK");
  }

  const dbTarget = parseHostPort(process.env.DATABASE_URL ?? "", 5432);
  const redisTarget = parseHostPort(process.env.REDIS_URL ?? "", 6379);
  const checks = [];

  if (dbTarget) {
    checks.push(checkPort(dbTarget.host, dbTarget.port, "Postgres"));
  } else {
    checks.push(Promise.resolve({ ok: false, message: "Postgres: DATABASE_URL is invalid" }));
  }

  if (redisTarget) {
    checks.push(checkPort(redisTarget.host, redisTarget.port, "Redis"));
  } else {
    checks.push(Promise.resolve({ ok: false, message: "Redis: REDIS_URL is invalid" }));
  }

  const results = await Promise.all(checks);
  for (const result of results) {
    if (result.ok) {
      console.log(result.message);
    } else {
      console.error(result.message);
      process.exitCode = 1;
    }
  }
}

run().catch((error) => {
  console.error("Doctor failed", error);
  process.exitCode = 1;
});
