import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "../env";
import * as schema from "../../../drizzle/schema";

let dbInstance: ReturnType<typeof drizzle> | null = null;
let clientInstance: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const env = getServerEnv();
  if (env.DATA_SOURCE !== "database" || !env.DATABASE_URL) {
    throw new Error(
      "Database mode is not enabled. Set DATA_SOURCE=database and provide DATABASE_URL.",
    );
  }

  clientInstance = postgres(env.DATABASE_URL, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  dbInstance = drizzle(clientInstance, { schema });
  return dbInstance;
}
