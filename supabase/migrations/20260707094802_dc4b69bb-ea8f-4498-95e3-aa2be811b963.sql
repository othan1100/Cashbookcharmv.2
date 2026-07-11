
ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS highlighted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS yearly_discount_pct integer NOT NULL DEFAULT 20;

UPDATE public.pricing_plans SET
  tagline = COALESCE(tagline, 'For growing businesses'),
  features = CASE WHEN features = '[]'::jsonb THEN
    '["Unlimited cashbooks","PDF & Excel exports","Customer reminders","Priority support"]'::jsonb
    ELSE features END,
  highlighted = true,
  sort_order = 1
WHERE id = 'pro';

UPDATE public.pricing_plans SET
  tagline = COALESCE(tagline, 'For teams & agencies'),
  features = CASE WHEN features = '[]'::jsonb THEN
    '["Everything in Pro","Team members & roles","Audit logs","Advanced permissions"]'::jsonb
    ELSE features END,
  sort_order = 2
WHERE id = 'team';
