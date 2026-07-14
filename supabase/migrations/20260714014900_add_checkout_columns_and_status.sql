-- Migration to add pending status and checkout columns to the subscriptions table to support the modern payment and checkout flow smoothly.

-- 1. Add 'pending' status to subscription_status enum
-- Since ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in some postgres setups, we run it conditionally or handle it.
-- Supabase migrations run safely with this:
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'pending';

-- 2. Add checkout support columns to subscriptions table
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS customer_account text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_gateway text;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS amount numeric;
