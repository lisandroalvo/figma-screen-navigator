import { describe, expect, it, vi, beforeEach } from "vitest";

// Sentinel thrown by our mocked next/navigation redirect so tests can assert
// that a redirect to /login happened (Next's real redirect also throws).
class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`);
  }
}

const state: {
  user: { id: string; email: string } | null;
  profileRows: { userId: string; email: string; role: string }[];
} = { user: null, profileRows: [] };

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to);
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () =>
        state.user
          ? { data: { user: state.user }, error: null }
          : { data: { user: null }, error: null },
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => state.profileRows,
        }),
      }),
    }),
    // Bootstrap insert path is not exercised in these tests (profiles preset).
    insert: () => ({ values: async () => undefined }),
  }),
}));

import { requireAuth, requireAdmin } from "./session";

beforeEach(() => {
  state.user = null;
  state.profileRows = [];
});

describe("requireAuth", () => {
  it("redirects anonymous callers to /login", async () => {
    state.user = null;
    await expect(requireAuth()).rejects.toMatchObject({ to: "/login" });
  });

  it("returns the profile for an authenticated user", async () => {
    state.user = { id: "u1", email: "qa@example.com" };
    state.profileRows = [{ userId: "u1", email: "qa@example.com", role: "qa_viewer" }];
    const profile = await requireAuth();
    expect(profile.role).toBe("qa_viewer");
  });
});

describe("requireAdmin", () => {
  it("redirects anonymous callers to /login", async () => {
    state.user = null;
    await expect(requireAdmin()).rejects.toMatchObject({ to: "/login" });
  });

  it("denies an authenticated non-admin (qa_viewer)", async () => {
    state.user = { id: "u2", email: "qa@example.com" };
    state.profileRows = [{ userId: "u2", email: "qa@example.com", role: "qa_viewer" }];
    await expect(requireAdmin()).rejects.toThrow(/Forbidden/);
  });

  it("allows a design administrator", async () => {
    state.user = { id: "u3", email: "admin@example.com" };
    state.profileRows = [
      { userId: "u3", email: "admin@example.com", role: "design_administrator" },
    ];
    const profile = await requireAdmin();
    expect(profile.role).toBe("design_administrator");
    expect(profile.userId).toBe("u3");
  });
});
