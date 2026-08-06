import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (val) => (val === "" ? undefined : val),
  z.string().min(1).optional(),
);

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverEnvSchema = z.object({
  DATA_SOURCE: z.enum(["database", "mock"]).default("database"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: optionalNonEmptyString,
  DATABASE_DIRECT_URL: optionalNonEmptyString,
  FIGMA_ACCESS_TOKEN: optionalNonEmptyString,
  FIGMA_PENSION_CALCULATION_FILE_KEY: optionalNonEmptyString,
  FIGMA_WEBHOOK_SECRET: optionalNonEmptyString,
  ADMIN_EMAILS: optionalNonEmptyString,
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getPublicEnv(): PublicEnv {
  // Static references are required so Next.js can inline NEXT_PUBLIC_*
  // values into the browser bundle at build/dev time.
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    DATA_SOURCE: process.env.DATA_SOURCE,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL,
    FIGMA_ACCESS_TOKEN: process.env.FIGMA_ACCESS_TOKEN,
    FIGMA_PENSION_CALCULATION_FILE_KEY:
      process.env.FIGMA_PENSION_CALCULATION_FILE_KEY,
    FIGMA_WEBHOOK_SECRET: process.env.FIGMA_WEBHOOK_SECRET,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  });
}

export function isDatabaseMode(): boolean {
  return getServerEnv().DATA_SOURCE === "database";
}
