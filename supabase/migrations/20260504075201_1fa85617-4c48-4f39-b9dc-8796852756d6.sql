-- Pricing plans (admin-editable)
CREATE TABLE IF NOT EXISTS public.pricing_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  tagline text,
  monthly_price numeric NOT NULL DEFAULT 0,
  yearly_price numeric NOT NULL DEFAULT 0,
  yearly_discount_pct numeric NOT NULL DEFAULT 20,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  whop_link_monthly text,
  whop_link_yearly text,
  highlighted boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view plans"
  ON public.pricing_plans FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage plans"
  ON public.pricing_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_pricing_plans_updated
  BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_plans (id, name, tagline, monthly_price, yearly_price, yearly_discount_pct, features, highlighted, sort_order)
VALUES
  ('pro', 'Pro', 'For growing businesses', 9, 108, 20,
    '["Unlimited cashbooks","PDF / CSV exports","Customer reminders","Attachments & receipts","Priority support"]'::jsonb,
    true, 1),
  ('team', 'Team', 'Collaborate with your team', 24, 288, 20,
    '["Everything in Pro","Team members & roles","Audit logs","Shared cashbooks","Dedicated support"]'::jsonb,
    false, 2)
ON CONFLICT (id) DO NOTHING;

-- User language preference
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_language_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_language_check CHECK (language IN ('en','ar','so'));
  END IF;
END $$;

-- App settings (singleton row, admin-editable)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  support_email text,
  support_whatsapp text,
  support_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view settings"
  ON public.app_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage settings"
  ON public.app_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (id, support_email, support_whatsapp, support_message)
VALUES (1, 'support@cashbookcharm.com', '', 'We usually reply within 24 hours.')
ON CONFLICT (id) DO NOTHING;