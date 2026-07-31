CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."proposed_change_action" AS ENUM('new', 'update', 'rename', 'move', 'missing', 'duplicate', 'ambiguous', 'delete');--> statement-breakpoint
CREATE TYPE "public"."proposed_change_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('responsive_variant', 'state_variant', 'next', 'previous', 'related', 'replaces', 'replaced_by');--> statement-breakpoint
CREATE TYPE "public"."screen_status" AS ENUM('draft', 'qa_ready', 'deprecated', 'archived', 'missing_review');--> statement-breakpoint
CREATE TYPE "public"."sync_job_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "breakpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"figma_page_id" uuid NOT NULL,
	"figma_node_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"width" integer,
	"height" integer,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "breakpoint_page_node" UNIQUE("figma_page_id","figma_node_id")
);
--> statement-breakpoint
CREATE TABLE "figma_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"figma_node_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"order_index" integer NOT NULL,
	"is_searchable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_module_node" UNIQUE("module_id","figma_node_id")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"figma_file_key" text NOT NULL,
	"figma_file_name" text,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_figma_file_key_unique" UNIQUE("figma_file_key"),
	CONSTRAINT "module_product_slug" UNIQUE("product_id","slug")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "proposed_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_job_id" uuid NOT NULL,
	"screen_id" uuid,
	"action" "proposed_change_action" NOT NULL,
	"status" "proposed_change_status" DEFAULT 'pending' NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text
);
--> statement-breakpoint
CREATE TABLE "screen_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_screen_id" uuid NOT NULL,
	"target_screen_id" uuid NOT NULL,
	"type" "relationship_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rel_unique" UNIQUE("source_screen_id","target_screen_id","type")
);
--> statement-breakpoint
CREATE TABLE "screens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"figma_page_id" uuid NOT NULL,
	"breakpoint_id" uuid NOT NULL,
	"figma_file_key" text NOT NULL,
	"figma_page_node_id" text NOT NULL,
	"figma_node_id" text NOT NULL,
	"original_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"display_name" text NOT NULL,
	"figma_url" text NOT NULL,
	"preview_url" text,
	"status" "screen_status" DEFAULT 'draft' NOT NULL,
	"screen" text,
	"flow" text,
	"step" text,
	"scenario" text,
	"option" text,
	"condition" text,
	"behavior" text,
	"state" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"parent_path" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ambiguity_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_figma_modified_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screen_module_node" UNIQUE("module_id","figma_node_id")
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid,
	"status" "sync_job_status" DEFAULT 'pending' NOT NULL,
	"triggered_by" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "breakpoints" ADD CONSTRAINT "breakpoints_figma_page_id_figma_pages_id_fk" FOREIGN KEY ("figma_page_id") REFERENCES "public"."figma_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figma_pages" ADD CONSTRAINT "figma_pages_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_changes" ADD CONSTRAINT "proposed_changes_sync_job_id_sync_jobs_id_fk" FOREIGN KEY ("sync_job_id") REFERENCES "public"."sync_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_changes" ADD CONSTRAINT "proposed_changes_screen_id_screens_id_fk" FOREIGN KEY ("screen_id") REFERENCES "public"."screens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_relationships" ADD CONSTRAINT "screen_relationships_source_screen_id_screens_id_fk" FOREIGN KEY ("source_screen_id") REFERENCES "public"."screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_relationships" ADD CONSTRAINT "screen_relationships_target_screen_id_screens_id_fk" FOREIGN KEY ("target_screen_id") REFERENCES "public"."screens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screens" ADD CONSTRAINT "screens_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screens" ADD CONSTRAINT "screens_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screens" ADD CONSTRAINT "screens_figma_page_id_figma_pages_id_fk" FOREIGN KEY ("figma_page_id") REFERENCES "public"."figma_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screens" ADD CONSTRAINT "screens_breakpoint_id_breakpoints_id_fk" FOREIGN KEY ("breakpoint_id") REFERENCES "public"."breakpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "breakpoint_page_idx" ON "breakpoints" USING btree ("figma_page_id");--> statement-breakpoint
CREATE INDEX "page_module_idx" ON "figma_pages" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "proposed_change_job_idx" ON "proposed_changes" USING btree ("sync_job_id");--> statement-breakpoint
CREATE INDEX "proposed_change_screen_idx" ON "proposed_changes" USING btree ("screen_id");--> statement-breakpoint
CREATE INDEX "proposed_change_status_idx" ON "proposed_changes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rel_source_idx" ON "screen_relationships" USING btree ("source_screen_id");--> statement-breakpoint
CREATE INDEX "rel_target_idx" ON "screen_relationships" USING btree ("target_screen_id");--> statement-breakpoint
CREATE INDEX "rel_type_idx" ON "screen_relationships" USING btree ("type");--> statement-breakpoint
CREATE INDEX "screen_product_idx" ON "screens" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "screen_module_idx" ON "screens" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "screen_page_idx" ON "screens" USING btree ("figma_page_id");--> statement-breakpoint
CREATE INDEX "screen_breakpoint_idx" ON "screens" USING btree ("breakpoint_id");--> statement-breakpoint
CREATE INDEX "screen_status_idx" ON "screens" USING btree ("status");--> statement-breakpoint
CREATE INDEX "screen_scenario_idx" ON "screens" USING btree ("scenario");--> statement-breakpoint
CREATE INDEX "screen_option_idx" ON "screens" USING btree ("option");--> statement-breakpoint
CREATE INDEX "screen_state_idx" ON "screens" USING btree ("state");--> statement-breakpoint
CREATE INDEX "screen_behavior_idx" ON "screens" USING btree ("behavior");--> statement-breakpoint
CREATE INDEX "screen_display_name_trgm_idx" ON "screens" USING btree ("display_name");