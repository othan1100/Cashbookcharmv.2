-- Add plan tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS whop_user_id text;

-- Constrain plan_type to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_plan_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_plan_type_check
      CHECK (plan_type IN ('starter','pro','team'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_whop_user_id ON public.profiles(whop_user_id);

-- Whop webhook event log
CREATE TABLE IF NOT EXISTS public.whop_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text NOT NULL,
  whop_user_id text,
  user_id uuid,
  plan_type text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whop_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view whop events"
  ON public.whop_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage whop events"
  ON public.whop_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));