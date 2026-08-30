-- Additive: track the nearest ancestor "- Flow" SECTION for a searchable
-- section, so results can show "› parent Flow" when one genuinely exists.
-- Non-destructive (nullable columns only).
ALTER TABLE "flow_sections" ADD COLUMN IF NOT EXISTS "parent_flow_node_id" text;
ALTER TABLE "flow_sections" ADD COLUMN IF NOT EXISTS "parent_flow_name" text;
