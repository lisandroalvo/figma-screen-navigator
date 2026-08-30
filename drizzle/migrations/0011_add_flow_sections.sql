-- Additive: searchable Figma SECTION nodes (Annuity pilot, 2026-08-23).
-- Search-only; isolated from interactive `flows`. Non-destructive.
CREATE TABLE IF NOT EXISTS "flow_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "module_id" uuid NOT NULL REFERENCES "modules"("id") ON DELETE CASCADE,
  "figma_page_id" uuid NOT NULL REFERENCES "figma_pages"("id") ON DELETE CASCADE,
  "figma_file_key" text NOT NULL,
  "figma_page_node_id" text NOT NULL,
  "figma_node_id" text NOT NULL,
  "parent_node_id" text,
  "parent_name" text,
  "name" text NOT NULL,
  "normalized_name" text NOT NULL,
  "figma_url" text NOT NULL,
  "depth" integer,
  "is_flow_container" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'detected' NOT NULL,
  "last_synced_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "flow_section_module_node" UNIQUE ("module_id", "figma_node_id")
);
CREATE INDEX IF NOT EXISTS "flow_section_module_idx" ON "flow_sections" ("module_id");
CREATE INDEX IF NOT EXISTS "flow_section_page_idx" ON "flow_sections" ("figma_page_id");
CREATE INDEX IF NOT EXISTS "flow_section_status_idx" ON "flow_sections" ("status");
CREATE INDEX IF NOT EXISTS "flow_section_normalized_idx" ON "flow_sections" ("normalized_name");
