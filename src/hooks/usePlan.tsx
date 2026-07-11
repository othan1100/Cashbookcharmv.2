import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PlanType = "starter" | "pro" | "team";

export const PLAN_LIMITS = {
  starter: { cashbooks: 1, exports: false, reminders: false, team: false, audit: false },
  pro:     { cashbooks: Infinity, exports: true, reminders: true, team: false, audit: false },
  team:    { cashbooks: Infinity, exports: true, reminders: true, team: true, audit: true },
} as const;

type ProfileRow = {
  plan_type?: string | null;
  trial_ends_at?: string | null;
  trial_plan?: string | null;
};

export function usePlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanType>("starter");
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [onTrial, setOnTrial] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPlan("starter"); setOnTrial(false); setTrialEndsAt(null); setLoading(false); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("plan_type, trial_ends_at, trial_plan")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      const row = (data ?? null) as ProfileRow | null;
      const dbPlan = (row?.plan_type as PlanType) ?? "starter";
      const trialEnd = row?.trial_ends_at ? new Date(row.trial_ends_at) : null;
      const trialPlan = (row?.trial_plan as PlanType | undefined) ?? "pro";
      const now = Date.now();

      // Auto-downgrade: starter user whose trial expired stays starter.
      // Starter user whose trial is active → effectively gets trial plan.
      if (dbPlan === "starter" && trialEnd && trialEnd.getTime() > now) {
        setPlan(trialPlan);
        setOnTrial(true);
        setTrialEndsAt(trialEnd);
      } else {
        setPlan(dbPlan);
        setOnTrial(false);
        setTrialEndsAt(trialEnd);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user]);

  const trialDaysLeft = trialEndsAt && onTrial
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : 0;

  return { plan, limits: PLAN_LIMITS[plan], loading, onTrial, trialDaysLeft, trialEndsAt };
}
