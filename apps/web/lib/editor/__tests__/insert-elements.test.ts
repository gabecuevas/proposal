import { describe, expect, it } from "vitest";
import { insertVideo, normalizeVideoUrl } from "../insert-elements";

describe("normalizeVideoUrl", () => {
  it("accepts watch, short, embed and youtu.be URLs", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeVideoUrl("youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(normalizeVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  });

  it("rejects non-YouTube links", () => {
    expect(normalizeVideoUrl("https://vimeo.com/123")).toBeNull();
    expect(normalizeVideoUrl("not a url")).toBeNull();
    expect(normalizeVideoUrl("")).toBeNull();
  });
});

describe("insertVideo", () => {
  it("returns false when the editor is missing a valid URL", () => {
    const editor = {
      chain: () => ({
        focus: () => ({
          setYoutubeVideo: () => ({
            run: () => true,
          }),
        }),
      }),
    };
    expect(insertVideo(editor as never, "https://example.com")).toBe(false);
  });
});
