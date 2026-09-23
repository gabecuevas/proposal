import { describe, expect, test } from "vitest";
import { prisma } from "@repo/db";
import {
  consumeAuthToken,
  findValidAuthToken,
  generateOpaqueToken,
  hashOpaqueToken,
  issueAuthToken,
} from "../auth-tokens";

describe("auth tokens", () => {
  test("hashOpaqueToken is deterministic", () => {
    expect(hashOpaqueToken("abc")).toBe(hashOpaqueToken("abc"));
    expect(hashOpaqueToken("abc")).not.toBe(hashOpaqueToken("def"));
  });

  test("consumeAuthToken is atomic and single-use", async () => {
    const email = `token-test-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        name: "Token Test",
        password_hash: "hash",
      },
    });

    const { rawToken, tokenId } = await issueAuthToken({
      userId: user.id,
      purpose: "EMAIL_VERIFY",
      ttlMs: 60_000,
    });

    const found = await findValidAuthToken({ rawToken, purpose: "EMAIL_VERIFY" });
    expect(found?.id).toBe(tokenId);

    const first = await consumeAuthToken({
      tokenId,
      userId: user.id,
      purpose: "EMAIL_VERIFY",
    });
    const second = await consumeAuthToken({
      tokenId,
      userId: user.id,
      purpose: "EMAIL_VERIFY",
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });
});
