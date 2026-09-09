import { describe, expect, it } from "vitest";
import { assetUrl, keyBelongsToWorkspace, workspaceUploadPrefix } from "../asset-url";
import { isValidObjectKey } from "../object-store";

describe("keyBelongsToWorkspace", () => {
  it("accepts keys under the workspace prefix", () => {
    const key = `${workspaceUploadPrefix("w1")}abc/page-1.jpg`;
    expect(keyBelongsToWorkspace(key, "w1")).toBe(true);
  });

  it("rejects another workspace's key", () => {
    const key = `${workspaceUploadPrefix("w2")}abc/page-1.jpg`;
    expect(keyBelongsToWorkspace(key, "w1")).toBe(false);
  });

  it("rejects a workspace id used as a prefix of another", () => {
    const key = `${workspaceUploadPrefix("w1-extra")}abc/page-1.jpg`;
    expect(keyBelongsToWorkspace(key, "w1")).toBe(false);
  });
});

describe("assetUrl", () => {
  it("builds a same-origin path by default", () => {
    expect(assetUrl("workspaces/w1/uploads/a/page-1.jpg")).toBe(
      "/api/uploads/workspaces/w1/uploads/a/page-1.jpg",
    );
  });

  it("adds an absolute base and token for detached renderers", () => {
    expect(
      assetUrl("workspaces/w1/uploads/a/page-1.jpg", {
        baseUrl: "https://app.example.com/",
        token: "tok en",
      }),
    ).toBe("https://app.example.com/api/uploads/workspaces/w1/uploads/a/page-1.jpg?token=tok%20en");
  });
});

describe("isValidObjectKey", () => {
  it("rejects traversal and absolute keys", () => {
    expect(isValidObjectKey("workspaces/w1/uploads/../../etc/passwd")).toBe(false);
    expect(isValidObjectKey("/etc/passwd")).toBe(false);
    expect(isValidObjectKey("workspaces//w1/page.jpg")).toBe(false);
    expect(isValidObjectKey("")).toBe(false);
  });

  it("accepts a normal upload key", () => {
    expect(isValidObjectKey("workspaces/w1/uploads/abc/page-1.jpg")).toBe(true);
  });
});
