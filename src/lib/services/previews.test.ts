import { describe, expect, it } from "vitest";
import { isPreviewExpired } from "./previews";

describe("isPreviewExpired", () => {
  it("returns true when previewUrl is missing", () => {
    expect(isPreviewExpired({})).toBe(true);
  });

  it("returns true when the preview is past its expiry", () => {
    expect(
      isPreviewExpired({
        previewUrl: "https://example.com/img.png",
        previewExpiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe(true);
  });

  it("returns false for a fresh preview", () => {
    expect(
      isPreviewExpired({
        previewUrl: "https://example.com/img.png",
        previewExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      }),
    ).toBe(false);
  });
});
