-- Additive/relaxing: globalize screen detection. Screens may live under any
-- SECTION, not only a top-level "- Flow", so flow_id and figma_section_node_id
-- become nullable, and we record nearest parent SECTION + Flow context.
-- Non-destructive (no data removed).
ALTER TABLE "flow_screens" ALTER COLUMN "flow_id" DROP NOT NULL;
ALTER TABLE "flow_screens" ALTER COLUMN "figma_section_node_id" DROP NOT NULL;
ALTER TABLE "flow_screens" ADD COLUMN IF NOT EXISTS "parent_section_node_id" text;
ALTER TABLE "flow_screens" ADD COLUMN IF NOT EXISTS "parent_section_name" text;
ALTER TABLE "flow_screens" ADD COLUMN IF NOT EXISTS "parent_flow_node_id" text;
ALTER TABLE "flow_screens" ADD COLUMN IF NOT EXISTS "parent_flow_name" text;
