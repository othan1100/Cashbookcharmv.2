
-- 1. avatar_url on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Storage RLS for the 'avatars' bucket
DROP POLICY IF EXISTS "Avatars are readable by authenticated users" ON storage.objects;
CREATE POLICY "Avatars are readable by authenticated users"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Seed Pro and Team pricing plans
INSERT INTO public.pricing_plans (id, name, tagline, monthly_price, yearly_price, yearly_discount_pct, features, highlighted, sort_order, active)
VALUES
  (
    'pro', 'Pro', 'For growing businesses',
    9.99, 95.88, 20,
    '["Unlimited cashbooks","Unlimited transactions","Customer statements & PDF","Receipt scanning (AI)","Advanced reports","Priority email support"]'::jsonb,
    true, 1, true
  ),
  (
    'team', 'Team', 'For teams & multi-user businesses',
    24.99, 239.88, 20,
    '["Everything in Pro","Team members & roles","Shared cashbooks","Audit log","Dedicated onboarding","Priority WhatsApp support"]'::jsonb,
    false, 2, true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  yearly_discount_pct = EXCLUDED.yearly_discount_pct,
  features = EXCLUDED.features,
  highlighted = EXCLUDED.highlighted,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;
