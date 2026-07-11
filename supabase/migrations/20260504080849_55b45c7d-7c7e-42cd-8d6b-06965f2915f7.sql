
-- Make othan1100@gmail.com a full admin with Pro plan automatically (no payment needed)
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
      WHEN lower(NEW.email) IN ('othan11100@gmail.com','othan1100@gmail.com') THEN 'pro'
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

-- Backfill: promote othan1100 to admin + pro right now if account already exists
DO $$
DECLARE u_id uuid;
BEGIN
  SELECT id INTO u_id FROM auth.users WHERE lower(email) = 'othan1100@gmail.com' LIMIT 1;
  IF u_id IS NOT NULL THEN
    -- Remove any non-admin role and ensure admin role
    DELETE FROM public.user_roles WHERE user_id = u_id AND role <> 'admin'::app_role;
    INSERT INTO public.user_roles (user_id, role) VALUES (u_id, 'admin'::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles
      SET plan_type = 'pro', plan_updated_at = now()
      WHERE user_id = u_id;
  END IF;
END $$;

-- Seed default support contacts (only if not already set)
INSERT INTO public.app_settings (id, support_email, support_whatsapp, support_message, updated_at)
VALUES (1, 'info.support@cashbookcharm.com', '+252619172003', 'We are here to help. Pro & Team customers get priority WhatsApp support.', now())
ON CONFLICT (id) DO UPDATE
  SET support_email = COALESCE(public.app_settings.support_email, EXCLUDED.support_email),
      support_whatsapp = COALESCE(public.app_settings.support_whatsapp, EXCLUDED.support_whatsapp),
      support_message = COALESCE(public.app_settings.support_message, EXCLUDED.support_message);
