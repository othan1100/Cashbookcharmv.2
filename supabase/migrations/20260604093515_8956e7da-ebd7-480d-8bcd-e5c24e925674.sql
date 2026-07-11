-- Add trial tracking + auto-downgrade helper
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_plan text;

-- New users get a 14-day Pro trial unless admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, business_name, country, city, plan_type, plan_updated_at, trial_ends_at, trial_plan)
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
    now(),
    CASE
      WHEN lower(NEW.email) IN ('othan11100@gmail.com','othan1100@gmail.com') THEN NULL
      ELSE now() + interval '14 days'
    END,
    CASE
      WHEN lower(NEW.email) IN ('othan11100@gmail.com','othan1100@gmail.com') THEN NULL
      ELSE 'pro'
    END
  );

  INSERT INTO public.cashbooks (user_id, name, description)
  VALUES (NEW.id, 'Main Cashbook', 'Default cashbook for all transactions');

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

-- Ensure trigger exists for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();