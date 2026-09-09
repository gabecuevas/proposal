import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type StoredObject = {
  bytes: Uint8Array;
  contentType: string;
};

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION ?? "us-east-1";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return { endpoint, bucket, accessKeyId, secretAccessKey, region };
}

function localRoot(): string {
  return process.env.UPLOADS_LOCAL_DIR ?? path.resolve(process.cwd(), ".artifacts", "uploads");
}

/**
 * Object keys are embedded in URLs, so a traversal segment could otherwise escape
 * the uploads root and read arbitrary files off the web host.
 */
function resolveLocalPath(key: string): string {
  const root = localRoot();
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Invalid object key");
  }
  return target;
}

export function isValidObjectKey(key: string): boolean {
  if (!key || key.length > 512) {
    return false;
  }
  if (key.startsWith("/") || key.includes("\\") || key.includes("\0")) {
    return false;
  }
  return key.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function createClient(config: NonNullable<ReturnType<typeof getS3Config>>) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (!isValidObjectKey(key)) {
    throw new Error("Invalid object key");
  }

  const config = getS3Config();
  if (!config) {
    const target = resolveLocalPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    await writeFile(`${target}.contenttype`, contentType, "utf8");
    return;
  }

  const client = createClient(config);
  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string): Promise<StoredObject | null> {
  if (!isValidObjectKey(key)) {
    return null;
  }

  const config = getS3Config();
  if (!config) {
    const target = resolveLocalPath(key);
    try {
      const bytes = await readFile(target);
      let contentType = "application/octet-stream";
      try {
        contentType = (await readFile(`${target}.contenttype`, "utf8")).trim() || contentType;
      } catch {
        // Content type sidecar is best effort.
      }
      return { bytes, contentType };
    } catch {
      return null;
    }
  }

  const client = createClient(config);
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
    if (!object.Body) {
      return null;
    }
    const bytes = await object.Body.transformToByteArray();
    return { bytes, contentType: object.ContentType ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
