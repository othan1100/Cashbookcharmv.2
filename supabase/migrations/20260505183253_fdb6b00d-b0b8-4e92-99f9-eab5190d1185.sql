-- Team collaboration system
CREATE TYPE public.team_member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE public.team_invite_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My Team',
  member_limit integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.team_member_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.team_member_role NOT NULL DEFAULT 'viewer',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status public.team_invite_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Shared cashbooks: add team_id to cashbooks
ALTER TABLE public.cashbooks ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- Helper functions (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.team_member_role(_user_id uuid, _team_id uuid)
RETURNS public.team_member_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id) THEN 'owner'::public.team_member_role
    ELSE (SELECT role FROM public.team_members WHERE team_id = _team_id AND user_id = _user_id LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.team_member_count(_team_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*)::int FROM public.team_members WHERE team_id = _team_id)
       + (SELECT count(*)::int FROM public.teams WHERE id = _team_id);
$$;

-- Enforce 10-member cap (owner counts)
CREATE OR REPLACE FUNCTION public.enforce_team_member_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_count int;
  cap int;
BEGIN
  SELECT member_limit INTO cap FROM public.teams WHERE id = NEW.team_id;
  SELECT public.team_member_count(NEW.team_id) INTO current_count;
  IF current_count >= cap THEN
    RAISE EXCEPTION 'Team member limit (%) reached', cap;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_enforce_team_member_limit
BEFORE INSERT ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_team_member_limit();

-- RLS: teams
CREATE POLICY "Members view their teams" ON public.teams FOR SELECT USING (public.is_team_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners manage teams" ON public.teams FOR ALL USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own team" ON public.teams FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- RLS: team_members
CREATE POLICY "Members view team members" ON public.team_members FOR SELECT USING (public.is_team_member(auth.uid(), team_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners manage members" ON public.team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users leave team" ON public.team_members FOR DELETE USING (auth.uid() = user_id);

-- RLS: team_invites
CREATE POLICY "Owners manage invites" ON public.team_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid()) OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Members view invites" ON public.team_invites FOR SELECT USING (public.is_team_member(auth.uid(), team_id) OR public.has_role(auth.uid(), 'admin'));

-- RLS: audit_logs
CREATE POLICY "Team members view audit logs" ON public.audit_logs FOR SELECT USING (
  (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id)) OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Users insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage audit logs" ON public.audit_logs FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow shared cashbook visibility/edit for team members
CREATE POLICY "Team members view shared cashbooks" ON public.cashbooks FOR SELECT USING (team_id IS NOT NULL AND public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Team editors update shared cashbooks" ON public.cashbooks FOR UPDATE USING (
  team_id IS NOT NULL AND public.team_member_role(auth.uid(), team_id) IN ('owner','admin','editor')
);
CREATE POLICY "Team editors insert shared cashbooks" ON public.cashbooks FOR INSERT WITH CHECK (
  team_id IS NULL OR public.team_member_role(auth.uid(), team_id) IN ('owner','admin','editor')
);

-- Update pricing plan amounts (Pro $7.20/mo $86.40/yr, Team $19.99/mo $239.88/yr)
UPDATE public.pricing_plans SET monthly_price = 7.20, yearly_price = 86.40, yearly_discount_pct = 0,
  features = '["Unlimited cashbooks","PDF / CSV exports","Customer reminders","Attachments & receipts","Priority support"]'::jsonb
WHERE id = 'pro';

UPDATE public.pricing_plans SET monthly_price = 19.99, yearly_price = 239.88, yearly_discount_pct = 0,
  features = '["Everything in Pro","Team members & roles (up to 10)","Shared cashbooks","Audit logs","Dedicated support"]'::jsonb
WHERE id = 'team';

-- Trigger: updated_at on teams
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
