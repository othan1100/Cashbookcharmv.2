import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, CheckCircle2, XCircle, ShieldCheck, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Phase = "form" | "processing" | "redirecting" | "error";

type DbPlan = {
  id: string;
  name: string;
  tagline: string | null;
  monthly_price: number;
  yearly_price: number;
  yearly_discount_pct: number;
  features: string[];
  highlighted: boolean;
};

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
  }
];

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planId = (searchParams.get("plan") ?? "pro").toLowerCase();
  const cycle = searchParams.get("cycle") === "monthly" ? "monthly" : "yearly";
  const auto = searchParams.get("auto") === "1";

  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [phase, setPhase] = useState<Phase>("form");
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.title = "Checkout — Cashbook Charm";
    (async () => {
      try {
        const { data } = await (supabase.from("pricing_plans") as any)
          .select("*")
          .eq("id", planId)
          .maybeSingle();

        if (data) {
          setPlan({
            ...data,
            features: Array.isArray(data.features) ? data.features : [],
          });
        } else {
          const fallback = DEFAULT_PLANS.find((p) => p.id === planId) ?? DEFAULT_PLANS[0];
          setPlan(fallback);
        }
      } catch {
        const fallback = DEFAULT_PLANS.find((p) => p.id === planId) ?? DEFAULT_PLANS[0];
        setPlan(fallback);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [planId, cycle]);

  // Auto-open the Sifalo gateway as soon as the plan is loaded — no form required.
  useEffect(() => {
    if (!auto || loadingPlan || !plan || phase !== "form") return;
    // fire-and-forget the submit handler
    handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, loadingPlan, plan, phase]);

  const price = plan ? (cycle === "yearly" ? plan.yearly_price : plan.monthly_price) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhase("processing");
    setMessage("Initializing Sifalo Pay secure checkout...");

    try {
      const { data, error } = await supabase.functions.invoke("sifalo-checkout", {
        body: {
          plan: planId,
          billing_cycle: cycle,
        },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Payment request failed");

      // Redirect to Sifalo hosted checkout page
      if (data.paymentUrl) {
        setPhase("redirecting");
        setMessage("Redirecting to Sifalo Pay secure checkout...");
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("No checkout URL returned from gateway");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setPhase("error");
      setMessage(err?.message || "Payment request failed. Please try again.");
      toast({
        title: "Checkout Failed",
        description: err?.message || "Failed to initialize checkout.",
        variant: "destructive",
      });
    }
  };

  if (loadingPlan) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/pricing")}
          className="rounded-xl gap-2 hover:bg-slate-200/50 text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Pricing
        </Button>
      </div>

      <div className="w-full max-w-5xl mx-auto grid gap-6 md:grid-cols-12 items-start">
        {/* Left column - order detail summary card */}
        <div className="md:col-span-5 bg-[#EDF7ED] rounded-2xl p-6 border border-[#C8E6C9] shadow-sm flex flex-col space-y-6">
          <div className="flex items-center gap-2 text-[#2E7D32] font-semibold text-[11px] uppercase tracking-wider bg-[#DBEFDB] py-1.5 px-3 rounded-lg w-max">
            <ShieldCheck className="h-4 w-4 text-[#2E7D32]" />
            Secure Hosted Checkout
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-[#1B5E20] tracking-tight">Complete your payment</h2>
            <p className="mt-2 text-xs text-[#388E3C] leading-relaxed font-medium">
              Review the payment details below, then proceed to Sifalo Pay's secure checkout to choose your preferred payment method.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E0E0E0]/50 flex flex-col items-center justify-center text-center py-8">
            <span className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-widest">
              You are paying
            </span>
            <div className="text-4xl font-extrabold text-slate-800 mt-2 flex items-baseline justify-center">
              <span className="text-2xl font-semibold mr-1">$</span>
              <span className="text-5xl font-black">{Number(price).toFixed(2)}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">
              {cycle} billing
            </span>
          </div>

          <div className="bg-white/80 rounded-xl p-4 border border-[#C8E6C9]/40 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
              <BookOpen className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Paying To</div>
              <div className="font-bold text-slate-800 text-sm">Cashbook Charm</div>
            </div>
          </div>

          <div className="flex items-center justify-center pt-2">
            <div className="bg-[#DBEFDB] text-[#2E7D32] font-bold text-[10px] tracking-wider uppercase py-1.5 px-4 rounded-full border border-[#C8E6C9]/50">
              Powered by SifaloPay
            </div>
          </div>
        </div>

        {/* Right column - payment options */}
        <div className="md:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 text-slate-800">
            <ShieldCheck className="h-5 w-5 text-[#163BB4]" />
            <h2 className="text-lg font-bold">Payment Options</h2>
          </div>

          {phase === "form" && (
            <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#163BB4]/10 text-[#163BB4]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    <strong>All major payment methods</strong>: Supports credit cards, debit cards, EVC Plus, eDahab, and other mobile wallets in one secure window.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#163BB4]/10 text-[#163BB4]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    <strong>100% Secure & Compliant</strong>: Protected by bank-grade SSL encryption and secure authorization.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#163BB4]/10 text-[#163BB4]">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    <strong>Instant Activation</strong>: Your subscription will be active immediately once the payment is completed.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full bg-[#163BB4] hover:bg-[#0F2D94] text-white font-extrabold h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-blue-950/20 flex items-center justify-center gap-2 transition-all"
                >
                  Proceed to Secure Payment
                </Button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 py-2.5 px-4 rounded-xl border border-emerald-100 font-semibold">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Secure, Encrypted Payments • PCI DSS Compliant</span>
              </div>
            </form>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center animate-pulse">
              <Loader2 className="h-12 w-12 animate-spin text-[#163BB4]" />
              <p className="text-sm font-bold text-slate-700">{message}</p>
            </div>
          )}

          {phase === "redirecting" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center animate-fadeIn">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-sm font-bold text-slate-700">{message}</p>
              <p className="text-xs text-slate-400">If you are not redirected automatically, please wait...</p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center animate-fadeIn">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <XCircle className="h-8 w-8" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Payment Failed</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{message}</p>
              <div className="flex gap-3 w-full mt-6">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl font-bold border-slate-200"
                  onClick={() => navigate("/pricing")}
                >
                  Pricing
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-[#163BB4] hover:bg-[#0F2D94] text-white font-bold"
                  onClick={() => setPhase("form")}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-[10px] text-slate-400 font-medium max-w-lg mx-auto mt-12 leading-relaxed">
        Payments processed via secure Sifalo Pay connection. All communications are encrypted.
      </div>
    </div>
  );
}
