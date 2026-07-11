-- Add attachment_url and credit/debit support to transactions
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'credit';
ALTER TYPE public.tx_type ADD VALUE IF NOT EXISTS 'debit';

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Storage bucket for receipts/invoices
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for receipts bucket
DO $$ BEGIN
  CREATE POLICY "Receipts are publicly readable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'receipts');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users upload own receipts"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own receipts"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own receipts"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;