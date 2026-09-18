import { afterEach, describe, expect, it } from "vitest";
import { isFlowDocumentPrototypeEnabled } from "../access";

describe("isFlowDocumentPrototypeEnabled", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAllow = process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousAllow === undefined) {
      delete process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;
    } else {
      process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE = previousAllow;
    }
  });

  it("is enabled in non-production by default", () => {
    process.env.NODE_ENV = "development";
    delete process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;
    expect(isFlowDocumentPrototypeEnabled()).toBe(true);
  });

  it("is disabled in production without override", () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;
    expect(isFlowDocumentPrototypeEnabled()).toBe(false);
  });

  it("can be force-enabled in production with ALLOW_FLOW_DOCUMENT_PROTOTYPE=1", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE = "1";
    expect(isFlowDocumentPrototypeEnabled()).toBe(true);
  });
});
