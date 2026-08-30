-- Additive: Module -> Page -> Flow -> SCREEN leaf (Annuity pilot, 2026-08-21).
-- Dedicated table, isolated from legacy `screens` and from `flow_steps`.
-- Non-destructive: creates a new table only.
CREATE TABLE IF NOT EXISTS "flow_screens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "figma_page_id" uuid NOT NULL REFERENCES "figma_pages"("id") ON DELETE CASCADE,
  "flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
  "figma_file_key" text NOT NULL,
  "figma_page_node_id" text NOT NULL,
  "figma_section_node_id" text NOT NULL,
  "figma_node_id" text NOT NULL,
  "figma_frame_name" text NOT NULL,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "figma_url" text NOT NULL,
  "width" integer,
  "height" integer,
  "detection_confidence" text NOT NULL,
  "detection_reason" text,
  "status" text DEFAULT 'detected' NOT NULL,
  "order_index" integer,
  "last_synced_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "flow_screen_module_node" UNIQUE ("module_id", "figma_node_id")
);
CREATE INDEX IF NOT EXISTS "flow_screen_flow_idx" ON "flow_screens" ("flow_id");
CREATE INDEX IF NOT EXISTS "flow_screen_module_idx" ON "flow_screens" ("module_id");
CREATE INDEX IF NOT EXISTS "flow_screen_page_idx" ON "flow_screens" ("figma_page_id");
CREATE INDEX IF NOT EXISTS "flow_screen_status_idx" ON "flow_screens" ("status");
CREATE INDEX IF NOT EXISTS "flow_screen_normalized_idx" ON "flow_screens" ("normalized_name");
