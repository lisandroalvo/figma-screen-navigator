import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "@/lib/env";
import * as schema from "../../../drizzle/schema";

export function getDb() {
  const env = getServerEnv();
  const client = postgres(env.DATABASE_URL, { prepare: false });
  return drizzle(client, { schema });
}
