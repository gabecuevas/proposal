import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseAudienceFilters,
  audienceFiltersToWhere,
  summarizeAudience,
} from "@/lib/support/audience";
import {
  extractEmailAddress,
  verifyResendWebhookSignature,
} from "@/lib/support/webhook-verify";
import { csvEscapeCell } from "@/lib/support/csv";
import {
  isSupportAdminEnabled,
  isSupportCampaignsEnabled,
  isSupportEmailEnabled,
  isSupportMessengerEnabled,
  platformAdminEmails,
  supportEmailDelaySeconds,
} from "@/lib/support/flags";

describe("support flags", () => {
  it("default off when unset", () => {
    expect(isSupportAdminEnabled()).toBe(false);
    expect(isSupportMessengerEnabled()).toBe(false);
    expect(isSupportCampaignsEnabled()).toBe(false);
    expect(isSupportEmailEnabled()).toBe(false);
  });

  it("parses PLATFORM_ADMIN_EMAILS", () => {
    const prev = process.env.PLATFORM_ADMIN_EMAILS;
    process.env.PLATFORM_ADMIN_EMAILS = " Admin@Example.com , other@x.com ";
    expect(platformAdminEmails()).toEqual(["admin@example.com", "other@x.com"]);
    process.env.PLATFORM_ADMIN_EMAILS = prev;
  });

  it("clamps email delay", () => {
    const prev = process.env.SUPPORT_EMAIL_DELAY_SECONDS;
    process.env.SUPPORT_EMAIL_DELAY_SECONDS = "99999";
    expect(supportEmailDelaySeconds()).toBe(3600);
    process.env.SUPPORT_EMAIL_DELAY_SECONDS = prev;
  });
});

describe("csv escape", () => {
  it("neutralizes formula injection", () => {
    expect(csvEscapeCell("=cmd")).toBe("'=cmd");
    expect(csvEscapeCell("+1")).toBe("'+1");
    expect(csvEscapeCell("-1")).toBe("'-1");
    expect(csvEscapeCell("@sum")).toBe("'@sum");
    expect(csvEscapeCell('say "hi"')).toBe('"say ""hi"""');
  });
});

describe("audience filters", () => {
  it("rejects unknown fields and raw SQL-like paths", () => {
    const parsed = parseAudienceFilters({
      version: 1,
      conditions: [
        { field: "email'; DROP TABLE", op: "eq", value: "x" },
        { field: "last_login_at", op: "is_null" },
      ],
    });
    expect(parsed.conditions).toHaveLength(1);
    expect(parsed.conditions[0]?.field).toBe("last_login_at");
  });

  it("maps never-logged-in to explicit null", () => {
    const where = audienceFiltersToWhere(
      parseAudienceFilters({
        version: 1,
        conditions: [{ field: "last_login_at", op: "is_null" }],
      }),
    );
    expect(where).toEqual({ AND: [{ last_login_at: null }] });
  });

  it("summarizes AND conditions", () => {
    expect(
      summarizeAudience({
        version: 1,
        conditions: [
          { field: "email_verified", op: "eq", value: true },
          { field: "role", op: "eq", value: "OWNER" },
        ],
      }),
    ).toContain("AND");
  });
});

describe("webhook verify", () => {
  it("accepts a valid svix signature", () => {
    const secretBytes = Buffer.from("test-secret-key-bytes!!");
    const secret = `whsec_${secretBytes.toString("base64")}`;
    const payload = JSON.stringify({ type: "email.received" });
    const id = "msg_test";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signedContent = `${id}.${timestamp}.${payload}`;
    const sig = createHmac("sha256", secretBytes).update(signedContent).digest("base64");

    expect(
      verifyResendWebhookSignature({
        payload,
        svixId: id,
        svixTimestamp: timestamp,
        svixSignature: `v1,${sig}`,
        secret,
      }),
    ).toBe(true);
  });

  it("rejects invalid signatures", () => {
    const fakeSecret = `whsec_${Buffer.from("test").toString("base64")}`;
    expect(
      verifyResendWebhookSignature({
        payload: "{}",
        svixId: "msg",
        svixTimestamp: String(Math.floor(Date.now() / 1000)),
        svixSignature: "v1,deadbeef",
        secret: fakeSecret,
      }),
    ).toBe(false);
  });

  it("extracts bare email from From header", () => {
    expect(extractEmailAddress("Ada <ada@example.com>")).toBe("ada@example.com");
    expect(extractEmailAddress("ada@example.com")).toBe("ada@example.com");
  });
});
