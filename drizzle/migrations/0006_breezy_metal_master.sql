CREATE TYPE "public"."flow_guidance_type" AS ENUM('guidance', 'action', 'qa_note');--> statement-breakpoint
CREATE TYPE "public"."flow_interaction_source" AS ENUM('manual', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."flow_interaction_trigger" AS ENUM('click', 'branch', 'next');--> statement-breakpoint
CREATE TYPE "public"."flow_status" AS ENUM('draft', 'review_required', 'qa_ready', 'archived');--> statement-breakpoint
CREATE TYPE "public"."flow_step_type" AS ENUM('screen', 'decision');--> statement-breakpoint
CREATE TABLE "flow_guidance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"step_id" uuid,
	"figma_node_id" text NOT NULL,
	"text" text NOT NULL,
	"guidance_type" "flow_guidance_type" DEFAULT 'guidance' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_hotspots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interaction_id" uuid NOT NULL,
	"x_percent" integer NOT NULL,
	"y_percent" integer NOT NULL,
	"width_percent" integer NOT NULL,
	"height_percent" integer NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"source_step_id" uuid NOT NULL,
	"destination_step_id" uuid NOT NULL,
	"label" text,
	"trigger" "flow_interaction_trigger" DEFAULT 'click' NOT NULL,
	"source" "flow_interaction_source" DEFAULT 'manual' NOT NULL,
	"review_status" text DEFAULT 'proposed',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"figma_node_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"step_type" "flow_step_type" DEFAULT 'screen' NOT NULL,
	"preview_url" text,
	"preview_storage_path" text,
	"figma_x" integer,
	"figma_y" integer,
	"figma_width" integer,
	"figma_height" integer,
	"display_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_step_node" UNIQUE("flow_id","figma_node_id")
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"figma_page_id" uuid NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"figma_file_key" text NOT NULL,
	"figma_section_node_id" text NOT NULL,
	"figma_url" text NOT NULL,
	"preview_url" text,
	"preview_storage_path" text,
	"status" "flow_status" DEFAULT 'draft' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flow_module_section" UNIQUE("module_id","figma_section_node_id")
);
--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD CONSTRAINT "flow_guidance_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD CONSTRAINT "flow_guidance_step_id_flow_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."flow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_hotspots" ADD CONSTRAINT "flow_hotspots_interaction_id_flow_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."flow_interactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_interactions" ADD CONSTRAINT "flow_interactions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_interactions" ADD CONSTRAINT "flow_interactions_source_step_id_flow_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."flow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_interactions" ADD CONSTRAINT "flow_interactions_destination_step_id_flow_steps_id_fk" FOREIGN KEY ("destination_step_id") REFERENCES "public"."flow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_figma_page_id_figma_pages_id_fk" FOREIGN KEY ("figma_page_id") REFERENCES "public"."figma_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_guidance_flow_idx" ON "flow_guidance" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_guidance_step_idx" ON "flow_guidance" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "flow_hotspot_interaction_idx" ON "flow_hotspots" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "flow_interaction_flow_idx" ON "flow_interactions" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_interaction_source_idx" ON "flow_interactions" USING btree ("source_step_id");--> statement-breakpoint
CREATE INDEX "flow_step_flow_idx" ON "flow_steps" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_module_idx" ON "flows" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "flow_page_idx" ON "flows" USING btree ("figma_page_id");--> statement-breakpoint
CREATE INDEX "flow_status_idx" ON "flows" USING btree ("status");