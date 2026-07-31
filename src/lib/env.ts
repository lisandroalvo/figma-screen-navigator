import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (val) => (val === "" ? undefined : val),
  z.string().min(1).optional(),
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const baseServerSchema = z.object({
  DATA_SOURCE: z.enum(["database", "mock"]).default("database"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  FIGMA_ACCESS_TOKEN: optionalNonEmptyString,
  FIGMA_WEBHOOK_SECRET: optionalNonEmptyString,
  ADMIN_EMAILS: optionalNonEmptyString,
});

const databaseModeSchema = z.object({
  DATA_SOURCE: z.literal("database"),
  DATABASE_URL: z.string().min(1),
  DATABASE_DIRECT_URL: z.string().min(1),
});

const mockModeSchema = z.object({
  DATA_SOURCE: z.literal("mock"),
  DATABASE_URL: optionalNonEmptyString,
  DATABASE_DIRECT_URL: optionalNonEmptyString,
});

const serverEnvSchema = z
  .union([databaseModeSchema, mockModeSchema])
  .and(baseServerSchema);

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse(process.env);
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}

export function isDatabaseMode(): boolean {
  return getServerEnv().DATA_SOURCE === "database";
}
