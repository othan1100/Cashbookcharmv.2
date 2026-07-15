-- ============================================================
-- Fix 1: Revoke EXECUTE on rls_auto_enable from anon + authenticated
-- This is an event trigger function — it fires internally on DDL
-- events, never via REST. Revoking EXECUTE prevents public RPC calls.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- ============================================================
-- Fix 2: Revoke EXECUTE on has_role from anon + authenticated
-- Used in RLS policies (called internally by Postgres during
-- policy evaluation, not via REST). SECURITY DEFINER is required
-- to avoid RLS recursion on user_roles table.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM anon, authenticated;

-- ============================================================
-- Fix 3: Revoke EXECUTE on is_team_member from anon + authenticated
-- Same rationale as has_role — used in RLS policies internally.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.is_team_member(_user_id uuid, _team_id uuid) FROM anon, authenticated;

-- ============================================================
-- Fix 4: Revoke EXECUTE on team_member_role from anon + authenticated
-- Same rationale — used in RLS policies internally.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.team_member_role(_user_id uuid, _team_id uuid) FROM anon, authenticated;

-- ============================================================
-- Fix 5: Add RLS policies to payment_logs table
-- Table has RLS enabled but no policies — currently locked.
-- Add ownership-scoped CRUD policies (user_id is text, cast
-- auth.uid() to text for comparison).
-- ============================================================

CREATE POLICY "select_own_payment_logs"
  ON public.payment_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "insert_own_payment_logs"
  ON public.payment_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "update_own_payment_logs"
  ON public.payment_logs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "delete_own_payment_logs"
  ON public.payment_logs
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text);
