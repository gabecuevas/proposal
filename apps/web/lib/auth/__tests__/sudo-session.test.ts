import { describe, expect, it } from "vitest";
import {
  isSudoSession,
  sessionMaxAgeFor,
  signSessionToken,
  SESSION_MAX_AGE,
  SUDO_SESSION_MAX_AGE,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth/session";
import { accountStatus, contactFiltersToWhere, parseContactFilters } from "@/lib/support/contacts";
import { formatAccountId, formatUserId, parsePublicId } from "@/lib/support/public-ids";
import { formatIpCity, ipLocationFromHeaders } from "@/lib/support/geo";

const base: SessionPayload = {
  userId: "user_1",
  workspaceId: "ws_1",
  role: "OWNER",
  email: "user@example.com",
  emailVerified: true,
  companySetupComplete: true,
  teamStepComplete: true,
};

describe("sudo sessions", () => {
  it("round-trips impersonation claims", async () => {
    const token = await signSessionToken({
      ...base,
      impersonatorUserId: "admin_1",
      impersonationId: "imp_1",
    });
    const session = await verifySessionToken(token);
    expect(session?.impersonatorUserId).toBe("admin_1");
    expect(session?.impersonationId).toBe("imp_1");
    expect(session && isSudoSession(session)).toBe(true);
  });

  it("drops partial impersonation claims", async () => {
    const token = await signSessionToken({ ...base, impersonationId: "imp_1" });
    const session = await verifySessionToken(token);
    expect(session?.impersonationId).toBeUndefined();
    expect(session && isSudoSession(session)).toBe(false);
  });

  it("uses a short TTL for sudo sessions only", () => {
    expect(sessionMaxAgeFor(base)).toBe(SESSION_MAX_AGE);
    expect(
      sessionMaxAgeFor({ ...base, impersonatorUserId: "admin_1", impersonationId: "imp_1" }),
    ).toBe(SUDO_SESSION_MAX_AGE);
  });
});

describe("ip location", () => {
  it("decodes Vercel geo headers", () => {
    const location = ipLocationFromHeaders(
      new Headers({
        "x-vercel-ip-city": "San%20Diego",
        "x-vercel-ip-country-region": "CA",
        "x-vercel-ip-country": "US",
        "x-vercel-ip-timezone": "America/Los_Angeles",
      }),
    );
    expect(location?.timezone).toBe("America/Los_Angeles");
    expect(formatIpCity(location!)).toBe("San Diego, CA, US");
  });

  it("returns null without geo headers", () => {
    expect(ipLocationFromHeaders(new Headers())).toBeNull();
  });
});

describe("public ids", () => {
  it("formats and parses account and user ids", () => {
    expect(formatAccountId(12)).toBe("ACC-000012");
    expect(formatUserId(345)).toBe("USR-000345");
    expect(parsePublicId("acc-000012")).toEqual({ kind: "account", number: 12 });
    expect(parsePublicId("USR345")).toEqual({ kind: "user", number: 345 });
    expect(parsePublicId("gabe@cuevas.com")).toBeNull();
    expect(parsePublicId("USR-0")).toBeNull();
  });

  it("derives account status from members", () => {
    expect(accountStatus({ ownerArchived: false, memberCount: 2, disabledCount: 1 })).toBe("Active");
    expect(accountStatus({ ownerArchived: false, memberCount: 2, disabledCount: 2 })).toBe("Disabled");
    expect(accountStatus({ ownerArchived: true, memberCount: 1, disabledCount: 0 })).toBe("Archived");
  });
});

describe("contact filters", () => {
  it("defaults to the non-archived view", () => {
    expect(parseContactFilters(new URLSearchParams()).statuses).toEqual(["active", "disabled"]);
  });

  it("keeps only known values and treats an empty status list as any", () => {
    const filters = parseContactFilters(
      new URLSearchParams({ status: "", type: "owner,bogus", flags: "frozen,frozen" }),
    );
    expect(filters).toEqual({ statuses: [], types: ["owner"], flags: ["frozen"] });
    expect(contactFiltersToWhere(filters)).toHaveLength(2);
  });

  it("skips a group when every option is checked", () => {
    const where = contactFiltersToWhere({
      statuses: ["active", "disabled", "archived"],
      types: ["owner", "user"],
      flags: [],
    });
    expect(where).toEqual([]);
  });
});
