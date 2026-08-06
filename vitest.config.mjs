import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    env: {
      DATA_SOURCE: "mock",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost",
      SUPABASE_SERVICE_ROLE_KEY: "test",
    },
  },
});
