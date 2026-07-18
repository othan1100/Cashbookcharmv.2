/*
# Create subscriptions table for Sifalo Pay Checkout integration

## Purpose
Stores subscription records for the Sifalo Pay Checkout flow.
When a user clicks "Upgrade", the sifalo-checkout edge function
creates a pending subscription row, redirects the user to Sifalo's
hosted checkout page, and after the user returns to /payment-success
the sifalo-verify edge function verifies the payment and activates
the subscription + upgrades the user's profile plan_type.

## New Table: subscriptions
- id (uuid, primary key)
- user_id (uuid, not null, references auth.users)
- plan (text, not null) — "pro" or "team"
- billing_cycle (text, default "monthly") — "monthly" or "yearly"
- status (text, default "pending") — pending, active, cancelled, failed
- sid (text) — Sifalo Pay transaction ID
- order_id (text) — internal order reference passed to Sifalo as return_url query param
- amount (numeric) — payment amount in USD
- payment_type (text) — gateway returned by Sifalo (e.g. "EDAHAB")
- start_date (timestamptz) — when subscription was activated
- expire_date (timestamptz) — when subscription expires
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

## Security
- RLS enabled
- Owner-scoped CRUD: users can only access their own subscription rows
- Edge functions use the service role key which bypasses RLS
*/

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('pro', 'team')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'failed')),
  sid text,
  order_id text,
  amount numeric(10,2),
  payment_type text,
  start_date timestamptz,
  expire_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscriptions" ON public.subscriptions;
CREATE POLICY "select_own_subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subscriptions" ON public.subscriptions;
CREATE POLICY "insert_own_subscriptions"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_subscriptions" ON public.subscriptions;
CREATE POLICY "update_own_subscriptions"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_subscriptions" ON public.subscriptions;
CREATE POLICY "delete_own_subscriptions"
  ON public.subscriptions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_sid ON public.subscriptions(sid);
CREATE INDEX IF NOT EXISTS idx_subscriptions_order_id ON public.subscriptions(order_id);
