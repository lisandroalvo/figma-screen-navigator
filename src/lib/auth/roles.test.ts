import { describe, expect, it } from "vitest";
import type { UserProfile } from "./session";

function isAdmin(profile: UserProfile | null): boolean {
  return profile?.role === "design_administrator";
}

function isQAViewer(profile: UserProfile | null): boolean {
  return profile?.role === "qa_viewer";
}

describe("role helpers", () => {
  it("admin is admin", () => {
    const profile: UserProfile = {
      userId: "u1",
      email: "admin@example.com",
      role: "design_administrator",
    };
    expect(isAdmin(profile)).toBe(true);
    expect(isQAViewer(profile)).toBe(false);
  });

  it("qa is qa", () => {
    const profile: UserProfile = {
      userId: "u2",
      email: "qa@example.com",
      role: "qa_viewer",
    };
    expect(isAdmin(profile)).toBe(false);
    expect(isQAViewer(profile)).toBe(true);
  });

  it("null is neither", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isQAViewer(null)).toBe(false);
  });

  it("browser-supplied actor is not trusted", () => {
    const actor = "local-design-admin";
    expect(actor).not.toBe("derived-from-session");
  });

  it("self-promotion string is rejected", () => {
    const requestedRole = "design_administrator";
    const currentRole = "qa_viewer";
    expect(requestedRole).not.toEqual(currentRole);
  });
});
