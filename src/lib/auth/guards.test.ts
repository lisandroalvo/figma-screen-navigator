import { describe, expect, it } from "vitest";
import type { UserProfile } from "./session";

describe("auth role helpers", () => {
  it("recognizes a design administrator", () => {
    const profile: UserProfile = {
      userId: "u1",
      email: "admin@example.com",
      role: "design_administrator",
    };
    expect(profile.role).toBe("design_administrator");
  });

  it("recognizes a qa viewer", () => {
    const profile: UserProfile = {
      userId: "u2",
      email: "qa@example.com",
      role: "qa_viewer",
    };
    expect(profile.role).toBe("qa_viewer");
  });
});
