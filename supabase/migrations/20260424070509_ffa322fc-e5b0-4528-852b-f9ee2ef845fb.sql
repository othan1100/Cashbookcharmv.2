-- Update signup trigger to also assign viewer role to a specific account
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, business_name, country, city)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'business_name',
    NEW.raw_user_meta_data ->> 'country',
    NEW.raw_user_meta_data ->> 'city'
  );

  INSERT INTO public.cashbooks (user_id, name, description)
  VALUES (NEW.id, 'General Ledger', 'Default cashbook for all transactions');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(NEW.email) = 'othan11100@gmail.com' THEN 'admin'::app_role
      WHEN lower(NEW.email) = 'othan1100@gmail.com'  THEN 'viewer'::app_role
      ELSE 'user'::app_role
    END
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill viewer role for existing account
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'viewer'::app_role FROM auth.users WHERE lower(email) = 'othan1100@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;