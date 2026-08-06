ALTER TABLE "screen_variants" ADD COLUMN "preview_storage_path" text;--> statement-breakpoint
ALTER TABLE "screen_variants" ADD COLUMN "preview_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "screens" ADD COLUMN "preview_storage_path" text;--> statement-breakpoint
ALTER TABLE "screens" ADD COLUMN "preview_updated_at" timestamp with time zone;