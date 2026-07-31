import { z } from "zod";

/**
 * Public (browser-exposed) environment variables.
 * These may only begin with NEXT_PUBLIC_.
 *
 * Required when Supabase authentication is enabled.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Server-only environment variables.
 * These must never be imported into client components.
 *
 * Supabase and database variables are required when those integrations are enabled.
 * Figma variables are required when the Figma integration is enabled.
 * FIGMA_WEBHOOK_SECRET and ADMIN_EMAILS are optional for later phases.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  FIGMA_ACCESS_TOKEN: z.string().min(1),
  FIGMA_WEBHOOK_SECRET: z.string().min(1).optional(),
  ADMIN_EMAILS: z.string().min(1).optional(),
});

/**
 * No environment variables are required during the foundation phase.
 * These getters are called only when the corresponding integration is enabled.
 */
export const getPublicEnv = () => publicEnvSchema.parse(process.env);
export const getServerEnv = () => serverEnvSchema.parse(process.env);
