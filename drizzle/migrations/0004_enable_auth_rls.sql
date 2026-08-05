-- Enable Row Level Security on all application tables.
-- These policies assume the server-side application uses a privileged
-- database role that bypasses RLS (e.g. postgres or service_role). The
-- policies primarily protect against direct client-side access.

-- Helper function: returns the current profile role or NULL.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- products: readable by any authenticated user.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "products_authenticated_read" ON public.products;
CREATE POLICY "products_authenticated_read"
  ON public.products FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- modules: readable by any authenticated user.
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "modules_authenticated_read" ON public.modules;
CREATE POLICY "modules_authenticated_read"
  ON public.modules FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- figma_pages: readable by any authenticated user.
ALTER TABLE public.figma_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "figma_pages_authenticated_read" ON public.figma_pages;
CREATE POLICY "figma_pages_authenticated_read"
  ON public.figma_pages FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- breakpoints: readable by any authenticated user.
ALTER TABLE public.breakpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "breakpoints_authenticated_read" ON public.breakpoints;
CREATE POLICY "breakpoints_authenticated_read"
  ON public.breakpoints FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- screens: readable by authenticated users when qa_ready and figma sourced.
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "screens_qa_view" ON public.screens;
CREATE POLICY "screens_qa_view"
  ON public.screens FOR SELECT
  TO authenticated
  USING (
    status = 'qa_ready'
    AND source = 'figma'
    AND auth.uid() IS NOT NULL
  );

-- screen_variants: readable through the parent screen policy.
ALTER TABLE public.screen_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "screen_variants_qa_view" ON public.screen_variants;
CREATE POLICY "screen_variants_qa_view"
  ON public.screen_variants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.screens s
      WHERE s.id = screen_variants.screen_id
        AND s.status = 'qa_ready'
        AND s.source = 'figma'
    )
    AND auth.uid() IS NOT NULL
  );

-- screen_relationships: administrator only.
ALTER TABLE public.screen_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "screen_relationships_admin" ON public.screen_relationships;
CREATE POLICY "screen_relationships_admin"
  ON public.screen_relationships FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'design_administrator');

-- sync_jobs: administrator only.
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_jobs_admin" ON public.sync_jobs;
CREATE POLICY "sync_jobs_admin"
  ON public.sync_jobs FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'design_administrator');

-- proposed_changes: administrator only.
ALTER TABLE public.proposed_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposed_changes_admin" ON public.proposed_changes;
CREATE POLICY "proposed_changes_admin"
  ON public.proposed_changes FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'design_administrator');

-- audit_logs: administrator only.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_admin"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.current_user_role() = 'design_administrator');

-- profiles: users can read their own profile; admins can read all.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY "profiles_self_read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'design_administrator'
  );

-- No direct client write policies are granted. Mutations happen through
-- server-side actions using a privileged database role.
