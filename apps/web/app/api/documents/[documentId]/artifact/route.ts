import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { NextResponse, type NextRequest } from "next/server";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyArtifactDownloadToken } from "@/lib/auth/artifact-download";

type Params = { params: Promise<{ documentId: string }> };

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

async function readArtifactBytes(pdfKey: string): Promise<Uint8Array> {
  const s3 = getS3Config();
  if (!s3) {
    const localDir = process.env.PDF_LOCAL_ARTIFACTS_DIR ?? path.resolve(process.cwd(), ".artifacts", "pdfs");
    const targetPath = path.resolve(localDir, pdfKey);
    return readFile(targetPath);
  }

  const client = new S3Client({
    region: s3.region,
    endpoint: s3.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    },
  });
  const object = await client.send(
    new GetObjectCommand({
      Bucket: s3.bucket,
      Key: pdfKey,
    }),
  );
  if (!object.Body) {
    throw new Error("Artifact body not found");
  }
  const bytes = await object.Body.transformToByteArray();
  return bytes;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { documentId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 401 });
  }

  const payload = await verifyArtifactDownloadToken(token);
  if (!payload || payload.documentId !== documentId) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id: payload.documentId,
      workspace_id: payload.workspaceId,
    },
  });
  if (!document || !document.finalized_pdf_key || !document.doc_hash) {
    return NextResponse.json({ error: "Finalized document not found" }, { status: 404 });
  }
  if (document.finalized_pdf_key !== payload.pdfKey) {
    return NextResponse.json({ error: "Artifact token does not match current document" }, { status: 409 });
  }

  try {
    const bytes = await readArtifactBytes(document.finalized_pdf_key);
    const body = Buffer.from(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `inline; filename="${document.id}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Artifact bytes unavailable" }, { status: 404 });
  }
}
