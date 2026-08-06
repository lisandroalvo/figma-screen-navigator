import { describe, expect, it } from "vitest";
import { getPublicEnv, getServerEnv } from "@/lib/env";

describe("env", () => {
  it("parses public env", () => {
    const env = getPublicEnv();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("http://localhost");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost");
  });

  it("defaults to mock data source in tests", () => {
    const env = getServerEnv();
    expect(env.DATA_SOURCE).toBe("mock");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.DATABASE_DIRECT_URL).toBeUndefined();
  });
});
