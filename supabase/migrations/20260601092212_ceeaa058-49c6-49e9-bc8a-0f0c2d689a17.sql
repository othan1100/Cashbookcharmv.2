
-- 1) Update pricing + features
UPDATE public.pricing_plans
SET monthly_price = 9,
    yearly_price = 72,
    yearly_discount_pct = 17,
    tagline = 'For growing businesses',
    features = '[
      "Unlimited cashbooks",
      "Everything in Starter",
      "PDF / CSV exports",
      "Customer reminders",
      "Attachments & receipts",
      "Priority support",
      "Priority WhatsApp support"
    ]'::jsonb,
    updated_at = now()
WHERE id = 'pro';

UPDATE public.pricing_plans
SET monthly_price = 19.99,
    yearly_price = 159.99,
    yearly_discount_pct = 17,
    tagline = 'For teams & multiple users',
    features = '[
      "Everything in Pro",
      "Unlimited cashbooks",
      "Team members & roles (up to 10)",
      "Shared cashbooks",
      "Audit logs",
      "Dedicated support",
      "Priority WhatsApp support"
    ]'::jsonb,
    updated_at = now()
WHERE id = 'team';

-- 2) Active cashbook selection per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_cashbook_id uuid;

-- 3) Promote test admin to team plan (so they can test all features) — keep admin role
UPDATE public.profiles
SET plan_type = 'team', plan_updated_at = now()
WHERE user_id IN (
  SELECT id FROM auth.users WHERE lower(email) IN ('othan1100@gmail.com','othan11100@gmail.com')
);

-- 4) Update handle_new_user to give the test admin Team plan by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, business_name, country, city, plan_type, plan_updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'business_name',
    NEW.raw_user_meta_data ->> 'country',
    NEW.raw_user_meta_data ->> 'city',
    CASE
      WHEN lower(NEW.email) IN ('othan11100@gmail.com','othan1100@gmail.com') THEN 'team'
      ELSE 'starter'
    END,
    CASE
      WHEN lower(NEW.email) IN ('othan11100@gmail.com','othan1100@gmail.com') THEN now()
      ELSE NULL
    END
  );

  INSERT INTO public.cashbooks (user_id, name, description)
  VALUES (NEW.id, 'General Ledger', 'Default cashbook for all transactions');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(NEW.email) IN ('othan11100@gmail.com','othan1100@gmail.com') THEN 'admin'::app_role
      ELSE 'user'::app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;
