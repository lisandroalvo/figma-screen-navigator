import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "../env";
import * as schema from "../../../drizzle/schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const env = getServerEnv();
  if (env.DATA_SOURCE !== "database") {
    throw new Error(
      "Database mode is not enabled. Set DATA_SOURCE=database and provide DATABASE_URL.",
    );
  }

  const client = postgres(env.DATABASE_URL, { prepare: false });
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}
