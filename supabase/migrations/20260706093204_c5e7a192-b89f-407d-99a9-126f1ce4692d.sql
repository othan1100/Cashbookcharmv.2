
-- Subscription status enum
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trial','active','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.billing_cycle AS ENUM ('monthly','yearly','trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'starter',
  billing_cycle public.billing_cycle NOT NULL DEFAULT 'trial',
  status public.subscription_status NOT NULL DEFAULT 'trial',
  sid text UNIQUE,
  start_date timestamptz NOT NULL DEFAULT now(),
  expire_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);

-- 2. Grants
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- 3. RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Extend handle_new_user to also insert a trial subscription
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

  INSERT INTO public.subscriptions (user_id, plan, billing_cycle, status, start_date, expire_date)
  VALUES (NEW.id, 'starter', 'trial', 'trial', now(), now() + interval '14 days');

  RETURN NEW;
END;
$function$;

-- 5. Backfill existing users
INSERT INTO public.subscriptions (user_id, plan, billing_cycle, status, start_date, expire_date)
SELECT
  p.user_id,
  COALESCE(p.plan_type, 'starter'),
  CASE WHEN COALESCE(p.plan_type, 'starter') = 'starter' THEN 'trial'::public.billing_cycle ELSE 'monthly'::public.billing_cycle END,
  CASE
    WHEN COALESCE(p.plan_type, 'starter') = 'starter' AND p.trial_ends_at > now() THEN 'trial'::public.subscription_status
    WHEN COALESCE(p.plan_type, 'starter') = 'starter' THEN 'expired'::public.subscription_status
    ELSE 'active'::public.subscription_status
  END,
  COALESCE(p.plan_updated_at, now()),
  COALESCE(p.trial_ends_at, now() + interval '30 days')
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.user_id);
