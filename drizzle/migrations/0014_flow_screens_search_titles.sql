-- Additive: enrich screen search with authored layer-name titles + deterministic
-- aliases. Text arrays, nullable. Non-destructive; no identity/data changes.
ALTER TABLE "flow_screens" ADD COLUMN IF NOT EXISTS "search_titles" text[];
ALTER TABLE "flow_screens" ADD COLUMN IF NOT EXISTS "search_aliases" text[];
