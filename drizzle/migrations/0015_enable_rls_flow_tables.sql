-- Security fix: enable Row-Level Security on the flow_* tables that were
-- publicly reachable via the Supabase REST API (PostgREST) using the public
-- anon key. Flagged by the Supabase security advisor as `rls_disabled_in_public`.
--
-- SAFE: the application accesses all data through a direct Postgres connection
-- (DATABASE_URL via postgres-js / Drizzle), which runs as the table owner and
-- BYPASSES RLS. The anon key is used only for Supabase Auth + Storage, never to
-- read these tables. Enabling RLS with no policies therefore denies the public
-- REST API (deny-by-default) while leaving the app's server-side access intact.
-- No public policies are added on purpose: these tables must not be reachable
-- through the public API at all.
--
-- Reversible with: ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_guidance ENABLE ROW LEVEL SECURITY;
