import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, CheckCircle2, Clock, XCircle, ShieldCheck, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SectionCard } from "@/components/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Gateway = "waafi" | "edahab" | "pbwallet";
type Phase = "form" | "processing" | "pending" | "success" | "error";

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

const GATEWAYS: { id: Gateway; label: string; hint: string }[] = [
  { id: "waafi", label: "WAAFI", hint: "EVC Plus / Hormuud Wallet" },
  { id: "edahab", label: "eDahab", hint: "Somtel eDahab Wallet" },
  { id: "pbwallet", label: "Premier Wallet", hint: "Premier Bank Wallet" },
];

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planId = (searchParams.get("plan") ?? "pro").toLowerCase();
  const cycle = searchParams.get("cycle") === "monthly" ? "monthly" : "yearly";

  const [plan, setPlan] = useState<DbPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [method, setMethod] = useState<"hosted" | "mobile" | "card">("hosted");
  const [gateway, setGateway] = useState<Gateway>("waafi");
  const [account, setAccount] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [message, setMessage] = useState("");
  const [sid, setSid] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string>("");

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

  const price = plan ? (cycle === "yearly" ? plan.yearly_price : plan.monthly_price) : 0;

  const invokeCheckout = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("sifalo-checkout", {
      body: payload,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Payment request failed");
    return data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = account.replace(/[^0-9+]/g, "");
    if (cleaned.length < 7) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid mobile number (at least 7 digits).",
        variant: "destructive",
      });
      return;
    }

    setPhase("processing");
    setMessage("Initializing Sifalo Pay secure wallet payment...");

    try {
      const data = await invokeCheckout({
        plan: planId,
        billing_cycle: cycle,
        account: cleaned,
        gateway,
        return_url: `${window.location.origin}/payment-success`,
      });

      setSid(data.sid);

      if (data.code === "601") {
        // Payment completed immediately (e.g. auto-approved)
        setPhase("success");
        setMessage(`Success! Your ${plan?.name} subscription is now active.`);
        toast({ title: "Payment Completed", description: "Your account is upgraded!" });
        setTimeout(() => navigate(`/payment-success?sid=${data.sid}`), 2000);
        return;
      }

      // 603 = pending — user needs to approve on phone or visit payment URL
      let finalPayUrl = data.paymentUrl || "";
      setPaymentUrl(finalPayUrl);
      setPhase("pending");
      setMessage(data.message || "Payment pending confirmation. Please approve the prompt on your phone.");

      if (finalPayUrl) {
        // Open payment page in new tab so user can complete
        window.open(finalPayUrl, "_blank");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setPhase("error");
      setMessage(err?.message || "Payment request failed. Please try again.");
      toast({
        title: "Payment Failed",
        description: err?.message || "Payment request failed.",
        variant: "destructive",
      });
    }
  };

  const handleHostedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhase("processing");
    setMessage("Initializing secure Sifalo Pay checkout experience...");

    try {
      const data = await invokeCheckout({
        plan: planId,
        billing_cycle: cycle,
        gateway: "checkout",
        return_url: `${window.location.origin}/payment-success`,
      });

      setSid(data.sid);

      if (data.paymentUrl) {
        setPaymentUrl(data.paymentUrl);
        // Redirect to Sifalo hosted checkout — user pays there, then returns to /payment-success
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("No checkout URL returned from gateway");
      }
    } catch (err: any) {
      console.error("Hosted checkout error:", err);
      setPhase("error");
      setMessage(err?.message || "Hosted payment initialization failed.");
      toast({
        title: "Checkout Failed",
        description: err?.message || "Failed to initialize checkout.",
        variant: "destructive",
      });
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Card payments go through hosted checkout (Sifalo handles card input securely)
    setPhase("processing");
    setMessage("Redirecting to secure card payment via Sifalo Pay...");

    try {
      const data = await invokeCheckout({
        plan: planId,
        billing_cycle: cycle,
        gateway: "checkout",
        return_url: `${window.location.origin}/payment-success`,
      });

      setSid(data.sid);
      if (data.paymentUrl) {
        setPaymentUrl(data.paymentUrl);
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("No checkout URL returned from gateway");
      }
    } catch (err: any) {
      setPhase("error");
      setMessage(err?.message || "Card payment initialization failed.");
      toast({
        title: "Checkout Failed",
        description: err?.message || "Failed to initialize card payment.",
        variant: "destructive",
      });
    }
  };

  const verifyPayment = async () => {
    if (!sid) return;
    setPhase("processing");
    setMessage("Verifying payment confirmation from Sifalo gateway...");

    try {
      const { data, error } = await supabase.functions.invoke("sifalo-verify", { body: { sid } });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        setPhase("success");
        setMessage(`Success! Your ${plan?.name} subscription is now active.`);
        toast({ title: "Payment Completed", description: "Your account is upgraded!" });
      } else {
        setPhase("pending");
        setMessage(data?.error || "We haven't received confirmation yet. Please make sure you approved it.");
        toast({
          title: "Still Pending",
          description: data?.error || "Payment not confirmed yet.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setPhase("error");
      setMessage(err?.message || "Verification request failed.");
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
              Review the payment details below, then choose your preferred payment option to continue.
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
            <ShieldCheck className="h-5 w-5 text-[#5B51D8]" />
            <h2 className="text-lg font-bold">Payment Options</h2>
          </div>

          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => { if (phase === "form") setMethod("hosted"); }}
              disabled={phase !== "form"}
              className={cn(
                "flex-1 pb-3 text-center text-xs sm:text-sm font-bold transition-all border-b-2",
                method === "hosted"
                  ? "border-[#5B51D8] text-[#5B51D8]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Secure Checkout
            </button>
            <button
              type="button"
              onClick={() => { if (phase === "form") setMethod("mobile"); }}
              disabled={phase !== "form"}
              className={cn(
                "flex-1 pb-3 text-center text-xs sm:text-sm font-bold transition-all border-b-2",
                method === "mobile"
                  ? "border-[#5B51D8] text-[#5B51D8]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Mobile Payment
            </button>
            <button
              type="button"
              onClick={() => { if (phase === "form") setMethod("card"); }}
              disabled={phase !== "form"}
              className={cn(
                "flex-1 pb-3 text-center text-xs sm:text-sm font-bold transition-all border-b-2",
                method === "card"
                  ? "border-[#5B51D8] text-[#5B51D8]"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              )}
            >
              Card
            </button>
          </div>

          {phase === "form" && (
            <div className="space-y-6 animate-fadeIn">
              {method === "hosted" ? (
                <form onSubmit={handleHostedSubmit} className="space-y-6">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5 space-y-4 animate-fadeIn">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B51D8]/10 text-[#5B51D8]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        <strong>All major payment methods</strong>: Supports credit cards, debit cards, EVC Plus, eDahab, and other mobile wallets in one secure window.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B51D8]/10 text-[#5B51D8]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        <strong>100% Secure & Compliant</strong>: Protected by bank-grade SSL encryption and secure authorization.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B51D8]/10 text-[#5B51D8]">
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
                      className="w-full bg-[#5B51D8] hover:bg-[#4B42B8] text-white font-extrabold h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
                    >
                      Proceed to Secure Payment
                    </Button>
                  </div>
                </form>
              ) : method === "card" ? (
                <form onSubmit={handleCardSubmit} className="space-y-5">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed text-center">
                      You will be redirected to Sifalo Pay's secure checkout page to enter your card details. We never store card information on our servers.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-[#5B51D8] hover:bg-[#4B42B8] text-white font-extrabold h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-indigo-600/20 flex items-center justify-center transition-all"
                    >
                      Proceed to Card Payment
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Choose Mobile Wallet Operator
                    </Label>
                    <RadioGroup
                      value={gateway}
                      onValueChange={(v) => setGateway(v as Gateway)}
                      className="grid gap-3 sm:grid-cols-3"
                    >
                      {GATEWAYS.map((g) => (
                        <label
                          key={g.id}
                          className={cn(
                            "flex flex-col cursor-pointer items-center justify-center gap-1 rounded-xl border border-slate-200 p-4 transition-all text-center hover:bg-slate-50",
                            gateway === g.id && "border-[#5B51D8] bg-indigo-50/50 ring-1 ring-[#5B51D8]"
                          )}
                        >
                          <RadioGroupItem value={g.id} id={`gateway-${g.id}`} className="sr-only" />
                          <div className="text-sm font-extrabold text-slate-800">{g.label}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{g.hint}</div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wallet-account" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Mobile Number
                    </Label>
                    <Input
                      id="wallet-account"
                      inputMode="tel"
                      placeholder="e.g. 252612345678"
                      required
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white text-slate-800 font-semibold"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">
                      A secure direct USSD push prompt will be sent directly to this phone number.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full bg-[#5B51D8] hover:bg-[#4B42B8] text-white font-extrabold h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-indigo-600/20 flex items-center justify-center transition-all"
                    >
                      Pay ${Number(price).toFixed(2)}
                    </Button>
                  </div>
                </form>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 py-2.5 px-4 rounded-xl border border-emerald-100 font-semibold">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Secure, Encrypted Payments • PCI DSS Compliant</span>
              </div>
            </div>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center animate-pulse">
              <Loader2 className="h-12 w-12 animate-spin text-[#5B51D8]" />
              <p className="text-sm font-bold text-slate-700">{message}</p>
            </div>
          )}

          {phase === "pending" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center animate-fadeIn">
              <Clock className="h-14 w-14 text-amber-500 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-800">Payment Pending Confirmation</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{message}</p>

              {paymentUrl && (
                <div className="w-full p-4 bg-blue-50/75 border border-blue-100 rounded-2xl text-left space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#5B51D8]">
                    <ShieldCheck className="h-4 w-4 text-[#5B51D8]" />
                    Sifalo Pay Gateway Link
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal font-medium">
                    Click the gateway link below to complete the payment authorization on your mobile account:
                  </p>
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B51D8] hover:bg-[#4B42B8] py-3 px-4 text-xs font-extrabold text-white transition-all shadow-md shadow-indigo-600/10"
                  >
                    Click Here to Pay (${Number(price).toFixed(2)})
                  </a>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
                  onClick={() => setPhase("form")}
                >
                  Change details
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-[#5B51D8] hover:bg-[#4B42B8] text-white font-bold"
                  onClick={verifyPayment}
                >
                  Verify Payment
                </Button>
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="flex flex-col items-center gap-4 py-10 text-center animate-fadeIn">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="h-8 w-8" strokeWidth={3} />
              </div>
              <h3 className="text-xl font-black text-slate-800">Payment Completed!</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{message}</p>
              <Button
                className="mt-6 rounded-xl px-10 bg-[#5B51D8] hover:bg-[#4B42B8] text-white font-extrabold h-11 shadow-md shadow-indigo-600/10"
                onClick={() => navigate("/")}
              >
                Go to Dashboard
              </Button>
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
                  className="flex-1 rounded-xl bg-[#5B51D8] hover:bg-[#4B42B8] text-white font-bold"
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
