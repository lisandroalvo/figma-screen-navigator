ALTER TABLE "flow_guidance" ADD COLUMN "scope" text DEFAULT 'step' NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "interaction_id" uuid;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "decision_step_id" uuid;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "confidence" text;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "review_status" text DEFAULT 'proposed' NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "figma_x" integer;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "figma_y" integer;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "figma_width" integer;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD COLUMN "figma_height" integer;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD CONSTRAINT "flow_guidance_interaction_id_flow_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."flow_interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_guidance" ADD CONSTRAINT "flow_guidance_decision_step_id_flow_steps_id_fk" FOREIGN KEY ("decision_step_id") REFERENCES "public"."flow_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_guidance_interaction_idx" ON "flow_guidance" USING btree ("interaction_id");--> statement-breakpoint
CREATE INDEX "flow_guidance_review_idx" ON "flow_guidance" USING btree ("review_status");