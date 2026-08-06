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

  it("accepts database data source", () => {
    process.env.DATA_SOURCE = "database";
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.DATABASE_DIRECT_URL = "postgres://localhost:5432/db";
    const env = getServerEnv();
    expect(env.DATA_SOURCE).toBe("database");
    process.env.DATA_SOURCE = "mock";
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_DIRECT_URL;
  });

  it("rejects invalid data source", () => {
    const original = process.env.DATA_SOURCE;
    process.env.DATA_SOURCE = "file";
    expect(() => getServerEnv()).toThrow();
    process.env.DATA_SOURCE = original ?? "mock";
  });
});
