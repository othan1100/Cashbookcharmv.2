
-- 1) Receipts: replace open SELECT policy with owner-scoped one
DROP POLICY IF EXISTS "Receipts are publicly readable" ON storage.objects;
CREATE POLICY "Users read own receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 2) Team-aware RLS on customers
CREATE POLICY "Team members view shared cashbook customers"
  ON public.customers FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cashbooks c
            WHERE c.id = customers.cashbook_id
              AND c.team_id IS NOT NULL
              AND public.is_team_member(auth.uid(), c.team_id))
  );

CREATE POLICY "Team editors insert shared cashbook customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.cashbooks c
                WHERE c.id = customers.cashbook_id
                  AND c.team_id IS NOT NULL
                  AND public.team_member_role(auth.uid(), c.team_id)
                        IN ('owner','admin','editor'))
  );

CREATE POLICY "Team editors update shared cashbook customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cashbooks c
            WHERE c.id = customers.cashbook_id
              AND c.team_id IS NOT NULL
              AND public.team_member_role(auth.uid(), c.team_id)
                    IN ('owner','admin','editor'))
  );

CREATE POLICY "Team editors delete shared cashbook customers"
  ON public.customers FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cashbooks c
            WHERE c.id = customers.cashbook_id
              AND c.team_id IS NOT NULL
              AND public.team_member_role(auth.uid(), c.team_id)
                    IN ('owner','admin','editor'))
  );

-- 3) Team-aware RLS on transactions
CREATE POLICY "Team members view shared cashbook transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cashbooks c
            WHERE c.id = transactions.cashbook_id
              AND c.team_id IS NOT NULL
              AND public.is_team_member(auth.uid(), c.team_id))
  );

CREATE POLICY "Team editors insert shared cashbook transactions"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.cashbooks c
                WHERE c.id = transactions.cashbook_id
                  AND c.team_id IS NOT NULL
                  AND public.team_member_role(auth.uid(), c.team_id)
                        IN ('owner','admin','editor'))
  );

CREATE POLICY "Team editors update shared cashbook transactions"
  ON public.transactions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cashbooks c
            WHERE c.id = transactions.cashbook_id
              AND c.team_id IS NOT NULL
              AND public.team_member_role(auth.uid(), c.team_id)
                    IN ('owner','admin','editor'))
  );

CREATE POLICY "Team editors delete shared cashbook transactions"
  ON public.transactions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.cashbooks c
            WHERE c.id = transactions.cashbook_id
              AND c.team_id IS NOT NULL
              AND public.team_member_role(auth.uid(), c.team_id)
                    IN ('owner','admin','editor'))
  );

-- 4) Prevent user_roles privilege escalation
CREATE OR REPLACE FUNCTION public.prevent_role_self_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  caller uuid;
BEGIN
  -- Exempt trigger-driven inserts from the signup flow (no JWT present).
  IF current_setting('request.jwt.claims', true) IS NULL
     OR current_setting('request.jwt.claims', true) = '' THEN
    RETURN NEW;
  END IF;

  caller := auth.uid();

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = caller AND role = 'admin'::public.app_role
  ) INTO is_admin;

  IF NEW.role = 'admin'::public.app_role AND NOT is_admin THEN
    RAISE EXCEPTION 'Only existing admins may grant the admin role';
  END IF;

  IF NEW.user_id <> caller AND NOT is_admin THEN
    RAISE EXCEPTION 'Only admins may assign roles to other users';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_self_grant ON public.user_roles;
CREATE TRIGGER prevent_role_self_grant
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_grant();

-- 5) Remove hardcoded admin email from handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, display_name, business_name, country, city,
    plan_type, plan_updated_at, trial_ends_at, trial_plan
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'business_name',
    NEW.raw_user_meta_data ->> 'country',
    NEW.raw_user_meta_data ->> 'city',
    'starter',
    now(),
    now() + interval '14 days',
    'pro'
  );

  INSERT INTO public.cashbooks (user_id, name, description)
  VALUES (NEW.id, 'Main Cashbook', 'Default cashbook for all transactions');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 6) Revoke EXECUTE on internal SECURITY DEFINER helpers from public/anon.
-- Authenticated retains EXECUTE on has_role / is_team_member / team_member_role
-- because RLS policies referencing them need it to evaluate for that role.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_member_role(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.team_member_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_team_member_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_self_grant() FROM PUBLIC, anon, authenticated;
