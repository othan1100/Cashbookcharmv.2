import { useEffect, useState } from "react";
import { Loader2, CreditCard, Crown, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { cn } from "@/lib/utils";

type Subscription = {
  id: string;
  plan: string;
  billing_cycle: string;
  status: string;
  amount: number | null;
  payment_gateway: string | null;
  customer_account: string | null;
  start_date: string | null;
  expire_date: string | null;
  created_at: string;
};

const STATUS_STYLE: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active:    { label: "Active",    icon: CheckCircle2, className: "bg-[hsl(var(--cash-in))/0.15] text-[hsl(var(--cash-in))]" },
  trial:     { label: "Trial",     icon: Clock,        className: "bg-primary/15 text-primary" },
  pending:   { label: "Pending",   icon: Clock,        className: "bg-amber-500/15 text-amber-600" },
  failed:    { label: "Failed",    icon: XCircle,      className: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", icon: XCircle,      className: "bg-muted text-muted-foreground" },
  expired:   { label: "Expired",   icon: XCircle,      className: "bg-muted text-muted-foreground" },
};

export function BillingTab() {
  const { user } = useAuth();
  const { plan, onTrial, trialDaysLeft } = usePlan();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setSubs((data as Subscription[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const activeSub = subs.find((s) => s.status === "active") || subs[0];

  if (loading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      {/* Current plan */}
      <SectionCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current plan</p>
              <h3 className="text-xl font-bold capitalize">{plan}{onTrial && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary align-middle">Trial</span>}</h3>
              {onTrial && (
                <p className="mt-0.5 text-xs text-muted-foreground">{trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} of trial remaining</p>
              )}
              {activeSub?.expire_date && !onTrial && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Renews on {new Date(activeSub.expire_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <Link to="/pricing">
            <Button className="rounded-xl gap-2">
              <CreditCard className="h-4 w-4" /> {plan === "starter" || onTrial ? "Upgrade plan" : "Change plan"}
            </Button>
          </Link>
        </div>
      </SectionCard>

      {/* History */}
      <SectionCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-base font-bold">Payment history</h3>
        </div>

        {subs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No payments yet. Upgrade to Pro or Team to unlock premium features.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Plan</th>
                  <th className="px-3 py-2 font-semibold">Cycle</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Method</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const meta = STATUS_STYLE[s.status] ?? STATUS_STYLE.pending;
                  const Icon = meta.icon;
                  return (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="px-3 py-2.5">{new Date(s.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2.5 capitalize font-medium">{s.plan}</td>
                      <td className="px-3 py-2.5 capitalize text-muted-foreground">{s.billing_cycle}</td>
                      <td className="px-3 py-2.5 font-mono">{s.amount != null ? `$${Number(s.amount).toFixed(2)}` : "—"}</td>
                      <td className="px-3 py-2.5 capitalize text-muted-foreground">
                        {s.payment_gateway || "—"}
                        {s.customer_account && <span className="ml-1 text-xs">· {s.customer_account}</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold", meta.className)}>
                          <Icon className="h-3 w-3" /> {meta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
