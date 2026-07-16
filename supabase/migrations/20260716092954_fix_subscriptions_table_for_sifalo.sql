/*
# Fix subscriptions table for Sifalo payment integration

## Problem
The `subscriptions` table was missing several columns that the
`sifalo-checkout` and `sifalo-verify` edge functions expect to write to:
- `billing_cycle` (monthly/yearly)
- `sid` (Sifalo transaction ID)
- `customer_account` (mobile wallet number)
- `payment_gateway` (waafi/edahab/pbwallet/checkout)
- `amount` (payment amount in USD)

Without these columns, every insert from the edge function silently
fails, and the upgrade flow breaks — the user clicks "Upgrade" but
nothing persists to the database.

Additionally, the table had RLS enabled with NO policies, making it
completely inaccessible (even to the service role client via the
frontend). This migration adds the missing columns and creates
owner-scoped CRUD policies.

## Changes

### 1. New columns on `subscriptions`
- `billing_cycle` text DEFAULT 'monthly' — monthly or yearly billing
- `sid` text — Sifalo transaction reference ID
- `customer_account` text — mobile wallet number or 'hosted_checkout'
- `payment_gateway` text — gateway used (waafi, edahab, pbwallet, checkout)
- `amount` numeric — payment amount in USD

### 2. RLS policies on `subscriptions`
- SELECT: users can view their own subscriptions
- INSERT: users can insert their own subscriptions
- UPDATE: users can update their own subscriptions
- DELETE: users can delete their own subscriptions

Note: The edge functions use the service role key which bypasses RLS,
so these policies are for any direct frontend access. The service role
client can always read/write regardless of policies.

### 3. Index
- Index on `user_id` for faster lookups by user
- Index on `sid` for faster verification lookups
*/

-- Add missing columns (idempotent)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS sid text,
  ADD COLUMN IF NOT EXISTS customer_account text,
  ADD COLUMN IF NOT EXISTS payment_gateway text,
  ADD COLUMN IF NOT EXISTS amount numeric;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_sid ON public.subscriptions(sid);

-- RLS is already enabled; add the missing policies
DROP POLICY IF EXISTS "select_own_subscriptions" ON public.subscriptions;
CREATE POLICY "select_own_subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subscriptions" ON public.subscriptions;
CREATE POLICY "insert_own_subscriptions"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_subscriptions" ON public.subscriptions;
CREATE POLICY "update_own_subscriptions"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_subscriptions" ON public.subscriptions;
CREATE POLICY "delete_own_subscriptions"
  ON public.subscriptions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
