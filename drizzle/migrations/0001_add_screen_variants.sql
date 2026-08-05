CREATE TYPE "public"."screen_source" AS ENUM('mock', 'figma', 'manual');--> statement-breakpoint
CREATE TYPE "public"."screen_variant_status" AS ENUM('active', 'missing_review', 'deprecated', 'archived');--> statement-breakpoint
CREATE TABLE "screen_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"screen_id" uuid NOT NULL,
	"breakpoint_id" uuid,
	"breakpoint_code" text,
	"figma_node_id" text NOT NULL,
	"figma_file_key" text NOT NULL,
	"figma_page_node_id" text NOT NULL,
	"original_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"figma_url" text NOT NULL,
	"preview_url" text,
	"width" integer,
	"height" integer,
	"parent_path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ambiguity_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" "screen_variant_status" DEFAULT 'active' NOT NULL,
	"last_figma_modified_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "variant_screen_node" UNIQUE("screen_id","figma_node_id")
);
--> statement-breakpoint
ALTER TABLE "screens" ADD COLUMN "source" "screen_source" DEFAULT 'figma' NOT NULL;--> statement-breakpoint
ALTER TABLE "screen_variants" ADD CONSTRAINT "screen_variants_screen_id_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_variants" ADD CONSTRAINT "screen_variants_breakpoint_id_breakpoints_id_fk" FOREIGN KEY ("breakpoint_id") REFERENCES "public"."breakpoints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variant_screen_idx" ON "screen_variants" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "variant_breakpoint_idx" ON "screen_variants" USING btree ("breakpoint_id");--> statement-breakpoint
CREATE INDEX "variant_breakpoint_code_idx" ON "screen_variants" USING btree ("breakpoint_code");--> statement-breakpoint
CREATE INDEX "variant_primary_idx" ON "screen_variants" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "variant_status_idx" ON "screen_variants" USING btree ("status");