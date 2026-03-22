#!/usr/bin/env node

import { execSync } from "node:child_process";

const defaultDatabaseUrl = "postgresql://proposal:proposal@localhost:5432/proposal";
const databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl;

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}

try {
  console.log("Resetting development database...");
  console.log(`DATABASE_URL=${databaseUrl}`);

  run("pnpm --filter @repo/db prisma migrate reset --force --skip-generate");
  run("pnpm --filter @repo/db prisma:generate");
  run("pnpm --filter @repo/db seed");

  console.log("\nDatabase reset complete.");
} catch (error) {
  console.error("\nDatabase reset failed.");
  process.exit(1);
}
