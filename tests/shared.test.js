import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/js/shared/html.js";
import { getYouTubeId } from "../src/js/shared/youtube.js";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });

  it("handles nullish values", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("getYouTubeId", () => {
  it("accepts bare IDs", () => {
    expect(getYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses watch URLs", () => {
    expect(getYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("parses youtu.be short links", () => {
    expect(getYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("parses embed URLs", () => {
    expect(getYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
  });

  it("returns empty for invalid input", () => {
    expect(getYouTubeId("")).toBe("");
    expect(getYouTubeId("short")).toBe("");
    expect(getYouTubeId("https://example.com/watch")).toBe("");
  });
});
