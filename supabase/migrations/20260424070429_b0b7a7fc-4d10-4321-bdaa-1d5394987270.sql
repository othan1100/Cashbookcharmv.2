-- Add 'viewer' role for read-only admin panel access
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';