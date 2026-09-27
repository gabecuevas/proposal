#!/usr/bin/env node
// Copies files written to the local uploads folder into the connected Vercel Blob store,
// keeping the same object keys so existing database references resolve in production.
// Usage: BLOB_READ_WRITE_TOKEN=... node scripts/backfill-uploads-to-blob.mjs [--dry-run]
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { head, put } from "@vercel/blob";

const dryRun = process.argv.includes("--dry-run");
const root = process.env.UPLOADS_LOCAL_DIR ?? path.resolve(process.cwd(), ".artifacts", "uploads");

if (!process.env.BLOB_READ_WRITE_TOKEN && !dryRun) {
  console.error("BLOB_READ_WRITE_TOKEN is required (or pass --dry-run).");
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (!entry.name.endsWith(".contenttype")) {
      yield full;
    }
  }
}

let uploaded = 0;
let skipped = 0;
for await (const file of walk(root)) {
  const key = path.relative(root, file).split(path.sep).join("/");
  let contentType = "application/octet-stream";
  try {
    contentType = (await readFile(`${file}.contenttype`, "utf8")).trim() || contentType;
  } catch {
    // Content type sidecar is best effort.
  }
  if (dryRun) {
    console.log(`[dry-run] ${key} (${contentType})`);
    continue;
  }
  const exists = await head(key).then(
    () => true,
    () => false,
  );
  if (exists) {
    skipped += 1;
    continue;
  }
  await put(key, await readFile(file), {
    access: "private",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  uploaded += 1;
  console.log(`uploaded ${key}`);
}
console.log(`Done. Uploaded ${uploaded}, already present ${skipped}.`);
