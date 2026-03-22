import type { NextRequest } from "next/server";
import { getRequestAuthContext } from "./request-context";
import {
  getSigningTokenFromRequest,
  verifySigningSessionToken,
  type SigningSessionPayload,
} from "./signing-session";

export type DocumentAccessContext =
  | {
      kind: "workspace-user";
      workspaceId: string;
      userId: string;
    }
  | {
      kind: "signing-recipient";
      workspaceId: string;
      recipientId: string;
      token: SigningSessionPayload;
    };

export async function getDocumentAccessContext(
  request: NextRequest,
  documentId: string,
): Promise<DocumentAccessContext> {
  try {
    const auth = await getRequestAuthContext(request);
    return {
      kind: "workspace-user",
      workspaceId: auth.workspaceId,
      userId: auth.userId,
    };
  } catch {
    const token = getSigningTokenFromRequest(request);
    if (!token) {
      throw new Error("Unauthorized");
    }
    const payload = await verifySigningSessionToken(token);
    if (!payload || payload.documentId !== documentId) {
      throw new Error("Unauthorized");
    }
    return {
      kind: "signing-recipient",
      workspaceId: payload.workspaceId,
      recipientId: payload.recipientId,
      token: payload,
    };
  }
}
