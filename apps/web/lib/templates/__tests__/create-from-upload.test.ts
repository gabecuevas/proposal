import { describe, expect, it } from "vitest";
import { isDocxUpload, isSupportedUpload } from "../create-from-upload";

describe("docx upload support", () => {
  it("accepts Google Docs / Word .docx by extension and MIME", () => {
    const byName = new File([new Uint8Array(0)], "nda.docx", {
      type: "application/octet-stream",
    });
    expect(isDocxUpload(byName)).toBe(true);
    expect(isSupportedUpload(byName)).toBe(true);

    const byMime = new File([new Uint8Array(0)], "export.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(isSupportedUpload(byMime)).toBe(true);

    const png = new File([new Uint8Array(0)], "photo.png", {
      type: "image/png",
    });
    expect(isSupportedUpload(png)).toBe(true);

    const doc = new File([new Uint8Array(0)], "legacy.doc", {
      type: "application/msword",
    });
    expect(isSupportedUpload(doc)).toBe(false);
  });
});
