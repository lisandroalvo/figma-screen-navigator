import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local" });

const databaseDirectUrl = process.env.DATABASE_DIRECT_URL;
if (!databaseDirectUrl) {
  throw new Error(
    "DATABASE_DIRECT_URL is not set. Add it to .env.local for database-backed execution.",
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseDirectUrl,
  },
});
