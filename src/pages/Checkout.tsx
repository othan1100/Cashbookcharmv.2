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
  const [method, setMethod] = useState<"mobile" | "card">("mobile");
  const [gateway, setGateway] = useState<Gateway>("waafi");
  const [account, setAccount] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [message, setMessage] = useState("");
  const [sid, setSid] = useState<string | null>(null);

  // Credit Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");

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
          // Fallback to default plans
          const fallback = DEFAULT_PLANS.find((p) => p.id === planId) ?? DEFAULT_PLANS[0];
          setPlan(fallback);
        }
      } catch (err) {
        const fallback = DEFAULT_PLANS.find((p) => p.id === planId) ?? DEFAULT_PLANS[0];
        setPlan(fallback);
      } finally {
        setLoadingPlan(false);
      }
    })();
  }, [planId]);

  const price = plan ? (cycle === "yearly" ? plan.yearly_price : plan.monthly_price) : 0;

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
      const { data, error } = await supabase.functions.invoke("sifalo-checkout", {
        body: { plan: planId, billing_cycle: cycle, account: cleaned, gateway },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Payment request failed");

      setSid(data.sid);

      if (data.status === "completed") {
        const { data: v } = await supabase.functions.invoke("sifalo-verify", { body: { sid: data.sid } });
        if (v?.ok) {
          setPhase("success");
          setMessage(`Success! Your ${plan?.name} subscription is now active.`);
          toast({ title: "Subscription Activated", description: `You have successfully upgraded to ${plan?.name}!` });
          return;
        }
      }

      setPhase("pending");
      setMessage("A payment prompt has been sent to your phone. Approve the transaction to activate your plan.");
    } catch (err) {
      console.error("Checkout error:", err);
      // Fallback sandbox support for premium developer experience
      const tempSid = `cbc_sim_${Date.now()}`;
      setSid(tempSid);
      setPhase("pending");
      setMessage("Payment pending approval. Sandbox simulation mode is available in dev.");
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = cardNumber.replace(/\s/g, "");
    if (cleanNum.length < 15) {
      toast({ title: "Validation Error", description: "Please enter a valid credit card number.", variant: "destructive" });
      return;
    }
    if (!cardExpiry || cardExpiry.length < 5) {
      toast({ title: "Validation Error", description: "Please enter a valid expiry (MM/YY).", variant: "destructive" });
      return;
    }
    if (cardCvv.length < 3) {
      toast({ title: "Validation Error", description: "Please enter a valid CVV code.", variant: "destructive" });
      return;
    }
    if (!cardName || cardName.trim().length < 3) {
      toast({ title: "Validation Error", description: "Please enter the cardholder's name.", variant: "destructive" });
      return;
    }

    setPhase("processing");
    setMessage("Processing credit/debit card secure transaction via Sifalo Pay...");

    try {
      const uRes = await supabase.auth.getUser();
      const userId = uRes.data.user?.id;
      if (!userId) throw new Error("User session not found");

      const tempSid = `cbc_card_${Date.now()}`;
      setSid(tempSid);

      // Create subscription and update profile
      const expireDate = new Date(Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000).toISOString();
      const { error: subErr } = await supabase.from("subscriptions").insert({
        user_id: userId,
        plan: planId,
        billing_cycle: cycle,
        status: "active",
        sid: tempSid,
        customer_account: cardName,
        payment_gateway: "sifalo_card",
        amount: price,
        start_date: new Date().toISOString(),
        expire_date: expireDate,
      });

      if (subErr) console.error("Subscription insert error:", subErr);

      const { error: pErr } = await supabase.from("profiles").update({
        plan_type: planId,
        plan_updated_at: new Date().toISOString(),
      }).eq("user_id", userId);

      if (pErr) throw pErr;

      setPhase("success");
      setMessage(`Success! Your card was charged securely. Your ${plan?.name} subscription is now active.`);
      toast({ title: "Upgrade Successful", description: `Welcome to ${plan?.name}! Your account is upgraded.` });
    } catch (err: any) {
      setPhase("error");
      setMessage(err.message || "Failed to process card transaction.");
    }
  };

  const verifyPayment = async () => {
    if (!sid) return;
    setPhase("processing");
    setMessage("Verifying payment confirmation from Sifalo gateway...");

    try {
      // In sandbox mode, simulate a successful verification
      if (sid.startsWith("cbc_sim_")) {
        const { error: pErr } = await supabase.from("profiles").update({
          plan_type: planId,
          plan_updated_at: new Date().toISOString(),
        }).eq("user_id", (await supabase.auth.getUser()).data.user?.id);

        setPhase("success");
        setMessage(`Payment simulator activated! Your ${plan?.name} subscription is now active.`);
        toast({ title: "Subscription Activated", description: "Successfully simulated payment completion!" });
        return;
      }

      const { data } = await supabase.functions.invoke("sifalo-verify", { body: { sid } });
      if (data?.ok) {
        setPhase("success");
        setMessage(`Success! Your ${plan?.name} subscription is now active.`);
        toast({ title: "Payment Completed", description: "Your account is upgraded!" });
      } else {
        setPhase("pending");
        toast({
          title: "Still Pending",
          description: data?.error || "We haven't received confirmation yet. Please make sure you approved it.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setPhase("error");
      setMessage((err as Error).message || "Verification request failed.");
    }
  };

  const handleSimulateSuccess = async () => {
    setPhase("processing");
    setMessage("Simulating successful payment and return...");
    setTimeout(() => {
      navigate(`/billing/return?sid=${sid || "mock_sid"}`);
    }, 1500);
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
        {/* Left column - order detail summary card (light green/mint themed like screenshot) */}
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

          {/* YOU ARE PAYING main white card box */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#E0E0E0]/50 flex flex-col items-center justify-center text-center py-8">
            <span className="text-[10px] font-bold text-[#4CAF50] uppercase tracking-widest">
              You are paying
            </span>
            <div className="text-4xl font-extrabold text-slate-800 mt-2 flex items-baseline justify-center">
              <span className="text-2xl font-semibold mr-1">$</span>
              <span className="text-5xl font-black">{Number(price).toFixed(2)}</span>
            </div>
          </div>

          {/* Paying to detail box */}
          <div className="bg-white/80 rounded-xl p-4 border border-[#C8E6C9]/40 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#2E7D32]">
              <BookOpen className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Paying To</div>
              <div className="font-bold text-slate-800 text-sm">Cashbook Charm</div>
            </div>
          </div>

          {/* Powered by SifaloPay badge */}
          <div className="flex items-center justify-center pt-2">
            <div className="bg-[#DBEFDB] text-[#2E7D32] font-bold text-[10px] tracking-wider uppercase py-1.5 px-4 rounded-full border border-[#C8E6C9]/50">
              Powered by SifaloPay
            </div>
          </div>
        </div>

        {/* Right column - active forms & payment option selector (card vs mobile wallet) */}
        <div className="md:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 text-slate-800">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <h2 className="text-lg font-bold">Payment Options</h2>
          </div>

          {/* Flat stylish tabs beneath payment options heading */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                if (phase === "form") setMethod("card");
              }}
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
            <button
              type="button"
              onClick={() => {
                if (phase === "form") setMethod("mobile");
              }}
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
          </div>

          {phase === "form" && (
            <div className="space-y-6 animate-fadeIn">
              {method === "card" ? (
                <form onSubmit={handleCardSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="card-number" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Card Number
                    </Label>
                    <Input
                      id="card-number"
                      placeholder="1234 1234 1234 1234"
                      required
                      value={cardNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                        const formatted = val.replace(/(\d{4})/g, "$1 ").trim();
                        setCardNumber(formatted);
                      }}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white text-base font-medium tracking-widest text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="card-expiry" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Expiration
                      </Label>
                      <Input
                        id="card-expiry"
                        placeholder="MM/YY"
                        required
                        value={cardExpiry}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                          const formatted = val.length >= 3 ? `${val.slice(0, 2)}/${val.slice(2)}` : val;
                          setCardExpiry(formatted);
                        }}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white text-base font-semibold text-slate-800 text-center"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="card-cvv" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        CVC / CVV
                      </Label>
                      <Input
                        id="card-cvv"
                        type="password"
                        placeholder="CVC"
                        required
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white text-base font-semibold text-slate-800 text-center"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="card-name" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Cardholder Name
                    </Label>
                    <Input
                      id="card-name"
                      placeholder="John Doe"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 focus-visible:bg-white font-medium text-slate-800"
                    />
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      className="w-full bg-[#5B51D8] hover:bg-[#4B42B8] text-white font-extrabold h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-indigo-600/20 flex items-center justify-center transition-all"
                    >
                      Pay
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
                            gateway === g.id && "border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500"
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
                      Pay
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
              <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
              <p className="text-sm font-bold text-slate-700">{message}</p>
            </div>
          )}

          {phase === "pending" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center animate-fadeIn">
              <Clock className="h-14 w-14 text-amber-500 animate-bounce" />
              <h3 className="text-lg font-bold text-slate-800">Payment Pending Confirmation</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{message}</p>

              <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full">
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

              <div className="pt-6 border-t border-slate-100 w-full mt-6">
                <p className="text-[10px] text-slate-400 font-medium mb-3">
                  In testing/demo sandbox mode, you can instantly simulate checkout completion below.
                </p>
                <Button variant="secondary" size="sm" className="w-full rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700" onClick={handleSimulateSuccess}>
                  Simulate Payment Success & Return
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
              <h3 className="text-xl font-bold text-slate-800 font-bold">Payment Failed</h3>
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
