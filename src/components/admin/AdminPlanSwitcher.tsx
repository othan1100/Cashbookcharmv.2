import { useEffect, useState } from "react";
import { Loader2, Crown, Sparkles, Users, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { PlanType } from "@/hooks/usePlan";

const PLANS: { id: PlanType; label: string; icon: typeof Sparkles; desc: string }[] = [
  { id: "starter", label: "Starter", icon: Sparkles, desc: "Free tier features only" },
  { id: "pro", label: "Pro", icon: Crown, desc: "Unlimited cashbooks, AI import, exports" },
  { id: "team", label: "Team", icon: Users, desc: "Team management + audit logs" },
];

export function AdminPlanSwitcher() {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [current, setCurrent] = useState<PlanType>("starter");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<PlanType | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("plan_type").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        setCurrent(((data?.plan_type as PlanType) ?? "starter"));
        setLoading(false);
      });
  }, [user]);

  if (!isAdmin) return null;

  const switchTo = async (plan: PlanType) => {
    if (!user || plan === current) return;
    setSwitching(plan);
    const { error } = await supabase.from("profiles")
      .update({ plan_type: plan, plan_updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setSwitching(null);
    if (error) return toast({ title: "Switch failed", description: error.message, variant: "destructive" });
    setCurrent(plan);
    toast({ title: `Switched to ${plan}`, description: "Reload to see plan-gated features." });
  };

  return (
    <SectionCard className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Crown className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-bold">Admin plan switcher</h3>
          <p className="text-xs text-muted-foreground">Freely switch your own plan to test features. No payment required.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-16 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          {PLANS.map((p) => {
            const Icon = p.icon;
            const isCurrent = current === p.id;
            return (
              <button
                key={p.id}
                onClick={() => switchTo(p.id)}
                disabled={isCurrent || switching !== null}
                className={`relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                  isCurrent
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border/60 bg-card hover:border-primary/40 hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  {isCurrent && <Check className="h-4 w-4 text-primary" />}
                  {switching === p.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                <p className="mt-1 text-sm font-semibold capitalize">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
