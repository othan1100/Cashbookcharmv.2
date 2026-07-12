import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Check, Crown, Sparkles, Users, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/SectionCard";
import { PaymentModal } from "@/components/PaymentModal";
import { usePlan, type PlanType } from "@/hooks/usePlan";
import { useI18n } from "@/hooks/useI18n";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { UpgradeButton } from "@/components/UpgradeButton";

type DbPlan = {
  id: string;
  name: string;
  tagline: string | null;
  monthly_price: number;
  yearly_price: number;
  yearly_discount_pct: number;
  features: string[];
  highlighted: boolean;
  sort_order: number;
  active: boolean;
};

const ICONS: Record<string, typeof Crown> = { pro: Crown, team: Users };

const DEFAULT_PLANS: DbPlan[] = [
  {
    id: "pro",
    name: "Pro",
    tagline: "For growing businesses",
    monthly_price: 5.99,
    yearly_price: 45.99,
    yearly_discount_pct: 36,
    features: ["Unlimited cashbooks", "Unlimited transactions", "Customer statements & PDF", "Receipt scanning (AI)", "Advanced reports", "Priority email support"],
    highlighted: true,
    sort_order: 1,
    active: true,
  },
  {
    id: "team",
    name: "Team",
    tagline: "For teams & multi-user businesses",
    monthly_price: 8.99,
    yearly_price: 69.99,
    yearly_discount_pct: 35,
    features: ["Everything in Pro", "Team members & roles", "Shared cashbooks", "Audit log", "Dedicated onboarding", "Priority WhatsApp support"],
    highlighted: false,
    sort_order: 2,
    active: true,
  }
];

export default function Pricing() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { plan: currentPlan, loading: planLoading } = usePlan();
  const [plans, setPlans] = useState<DbPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearly, setYearly] = useState(true);
  const [searchParams] = useSearchParams();
  const highlightParam = searchParams.get("highlight");
  const [supportWa, setSupportWa] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<DbPlan | null>(null);

  const handleUpgrade = (planId: string) => {
    navigate(`/checkout?plan=${planId}&cycle=${yearly ? "yearly" : "monthly"}`);
  };

  useEffect(() => {
    document.title = "Pricing — CashBook";
    (async () => {
      try {
        const [{ data: p }, { data: s }] = await Promise.all([
          (supabase.from("pricing_plans") as any).select("*").eq("active", true).order("sort_order"),
          supabase.from("app_settings").select("support_whatsapp").eq("id", 1).maybeSingle(),
        ]);
        
        const fetchedPlans = ((p as unknown as DbPlan[]) || []).map((x) => ({
          ...x,
          features: Array.isArray(x.features) ? x.features : [],
        }));

        if (fetchedPlans.length > 0) {
          setPlans(fetchedPlans);
        } else {
          setPlans(DEFAULT_PLANS);
        }
        setSupportWa((s as { support_whatsapp?: string | null } | null)?.support_whatsapp ?? null);
      } catch (err) {
        console.error("Error loading plans:", err);
        setPlans(DEFAULT_PLANS);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const waLink = supportWa ? `https://wa.me/${supportWa.replace(/[^0-9]/g, "")}` : null;

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      <header className="text-center max-w-2xl mx-auto px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{t("pricing")}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">{t("chooseYourPlan")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("pricingTagline")}</p>

        <div className="mt-5 inline-flex items-center gap-2 sm:gap-3 rounded-full border border-border/60 bg-card px-3 py-2 sm:px-4 max-w-full">
          <span className={cn("text-xs sm:text-sm font-medium", !yearly && "text-foreground", yearly && "text-muted-foreground")}>{t("monthly")}</span>
          <Switch checked={yearly} onCheckedChange={setYearly} aria-label="Toggle yearly billing" />
          <span className={cn("text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center", yearly && "text-foreground", !yearly && "text-muted-foreground")}>
            {t("yearly")}
            <span className="rounded-full bg-[hsl(var(--cash-in))]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--cash-in))]">Save 20%</span>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">+2 months free</span>
          </span>
        </div>

        {!planLoading && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("yourCurrentPlan")}: <span className="font-semibold text-foreground capitalize">{currentPlan}</span>
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard className="relative flex flex-col p-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Starter</h3>
              <p className="text-xs text-muted-foreground">Try the basics</p>
            </div>
          </div>
          <div className="mt-4"><span className="text-3xl font-bold">Free</span></div>
          <ul className="mt-5 space-y-2 flex-1">
            {["1 cashbook", "Basic transactions", "Customer balances", "Mobile + desktop access"].map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            {currentPlan === "starter"
              ? <Button disabled className="w-full rounded-xl">{t("currentPlan")}</Button>
              : <Button variant="outline" disabled className="w-full rounded-xl">Free tier</Button>}
          </div>
        </SectionCard>

        {plans.map((p) => {
          const Icon = ICONS[p.id] ?? Crown;
          const isCurrent = currentPlan === (p.id as PlanType);
          const isRecommended = highlightParam === p.id;
          const price = yearly ? p.yearly_price : p.monthly_price;
          const monthlyEquivalent = yearly && p.yearly_price ? (p.yearly_price / 12) : null;

          return (
            <SectionCard key={p.id}
              className={cn(
                "relative flex flex-col p-6",
                p.highlighted && "border-primary/60 ring-1 ring-primary/30",
                isRecommended && "border-primary ring-2 ring-primary/60 shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]",
              )}>
              {isRecommended ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                  Recommended for you
                </span>
              ) : p.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                  {t("mostPopular")}
                </span>
              )}
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{p.name}</h3>
                  {p.tagline && <p className="text-xs text-muted-foreground">{p.tagline}</p>}
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-1 flex-wrap">
                <span className="text-3xl font-bold">${Number(price).toFixed(price % 1 ? 2 : 0)}</span>
                <span className="text-sm text-muted-foreground">{yearly ? t("perYear") : t("perMonth")}</span>
              </div>
              {monthlyEquivalent && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ${monthlyEquivalent.toFixed(2)}{t("perMonth")} · {t("billedYearly")}
                </p>
              )}
              <ul className="mt-5 space-y-2 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{f}</span>
                  </li>
                ))}
                <li className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>Priority WhatsApp support</span>
                </li>
              </ul>
              <div className="mt-6 space-y-2">
                {isCurrent ? (
                  <Button disabled className="w-full rounded-xl">{t("currentPlan")}</Button>
                ) : (
                  <UpgradeButton
                    planName={p.name}
                    className="w-full"
                    onUpgrade={() => handleUpgrade(p.id)}
                  />
                )}
                {isCurrent && waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                     className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary py-2 text-sm font-medium hover:bg-secondary/80">
                    <MessageCircle className="h-4 w-4" /> WhatsApp support
                  </a>
                )}
              </div>
            </SectionCard>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground max-w-lg mx-auto px-4">
        Payments are processed securely by Sifalo Pay via mobile wallet (WAAFI, eDahab, Premier Wallet). Your plan activates automatically once payment is confirmed.
      </p>

      {payFor && (
        <PaymentModal
          open={!!payFor}
          onClose={() => setPayFor(null)}
          plan={payFor.id}
          planName={payFor.name}
          billingCycle={yearly ? "yearly" : "monthly"}
          amount={Number(yearly ? payFor.yearly_price : payFor.monthly_price)}
          onActivated={() => { setTimeout(() => window.location.reload(), 1200); }}
        />
      )}
    </div>
  );
}
