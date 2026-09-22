import { afterEach, describe, expect, it } from "vitest";
import { isFlowDocumentPrototypeEnabled } from "../access";

type MutableEnv = Record<string, string | undefined>;

function setNodeEnv(value: string | undefined) {
  (process.env as MutableEnv).NODE_ENV = value;
}

describe("isFlowDocumentPrototypeEnabled", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAllow = process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;

  afterEach(() => {
    setNodeEnv(previousNodeEnv);
    if (previousAllow === undefined) {
      delete process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;
    } else {
      process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE = previousAllow;
    }
  });

  it("is enabled in non-production by default", () => {
    setNodeEnv("development");
    delete process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;
    expect(isFlowDocumentPrototypeEnabled()).toBe(true);
  });

  it("is disabled in production without override", () => {
    setNodeEnv("production");
    delete process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE;
    expect(isFlowDocumentPrototypeEnabled()).toBe(false);
  });

  it("can be force-enabled in production with ALLOW_FLOW_DOCUMENT_PROTOTYPE=1", () => {
    setNodeEnv("production");
    process.env.ALLOW_FLOW_DOCUMENT_PROTOTYPE = "1";
    expect(isFlowDocumentPrototypeEnabled()).toBe(true);
  });
});
