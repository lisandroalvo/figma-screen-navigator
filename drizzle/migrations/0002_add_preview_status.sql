ALTER TYPE "public"."proposed_change_status" ADD VALUE 'needs_review' BEFORE 'approved';--> statement-breakpoint
ALTER TYPE "public"."proposed_change_status" ADD VALUE 'published';--> statement-breakpoint
ALTER TABLE "screen_variants" ADD COLUMN "preview_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "screen_variants" ADD COLUMN "preview_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "screen_variants" ADD COLUMN "preview_status" text;--> statement-breakpoint
ALTER TABLE "screen_variants" ADD COLUMN "preview_error" text;--> statement-breakpoint
ALTER TABLE "screen_variants" ADD COLUMN "last_preview_refresh_at" timestamp with time zone;