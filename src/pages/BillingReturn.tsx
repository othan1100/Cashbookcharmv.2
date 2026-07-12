import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, ArrowRight, ShieldCheck, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";

export default function BillingReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(5);
  const [activePlan, setActivePlan] = useState("");

  useEffect(() => {
    const sid = params.get("sid") ?? params.get("order_id") ?? params.get("id");
    if (!sid) { 
      setState("error"); 
      setMessage("Missing payment reference (SID). Please contact support if you believe this is an error."); 
      return; 
    }
    
    let isMounted = true;
    
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("sifalo-verify", { body: { sid } });
        if (!isMounted) return;
        
        if (error || !data?.ok) {
          setState("error");
          setMessage(data?.error ?? error?.message ?? "Payment verification failed or timed out.");
          return;
        }
        
        setState("ok");
        const planName = String(data.plan || "Pro").toUpperCase();
        setActivePlan(planName);
        setMessage(`Your account has been successfully upgraded to the ${planName} plan.`);
      } catch (err: any) {
        if (!isMounted) return;
        setState("error");
        setMessage(err.message || "An unexpected error occurred during verification.");
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [params]);

  // Handle return to dashboard manually
  const handleGoToDashboard = () => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-4">
        {/* Logo/Branding Header */}
        <div className="flex flex-col items-center mb-4">
          <div className="flex items-center gap-2 bg-[#163BB4]/10 py-1.5 px-3 rounded-full border border-[#163BB4]/20 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#163BB4]" />
            <span className="text-[10px] font-bold text-[#163BB4] uppercase tracking-wider">
              Secure Sifalo Pay Gateway
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Cashbook Charm</h2>
        </div>

        <SectionCard className="p-8 shadow-xl border border-slate-200 rounded-3xl bg-white relative overflow-hidden">
          {state === "loading" && (
            <div className="flex flex-col items-center py-6 text-center space-y-4 animate-pulse">
              <Loader2 className="h-12 w-12 animate-spin text-[#163BB4]" />
              <h1 className="text-xl font-extrabold text-slate-800">Verifying Payment...</h1>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                We are securing confirmation of your transaction from the network. This should only take a few seconds.
              </p>
            </div>
          )}

          {state === "ok" && (
            <div className="flex flex-col items-center py-4 text-center space-y-5 animate-fadeIn">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
                <BadgeCheck className="h-10 w-10" strokeWidth={2.5} />
              </div>
              
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Payment Successful!</h1>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
                  {activePlan} Account Active
                </p>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed max-w-sm px-2">
                {message} All premium limits and business features have been unlocked immediately.
              </p>

              <div className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-[11px] text-slate-500 font-medium">
                Your payment is fully verified. Click below to explore your new premium features.
              </div>

              <Button 
                className="w-full bg-[#163BB4] hover:bg-[#0F2D94] text-white font-extrabold h-12 rounded-xl text-sm tracking-wide shadow-lg shadow-blue-950/20 gap-2 mt-2 transition-all" 
                onClick={handleGoToDashboard}
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center py-4 text-center space-y-5 animate-fadeIn">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-inner">
                <XCircle className="h-10 w-10" strokeWidth={2.5} />
              </div>
              
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Verification Failed</h1>
              
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm px-2">
                {message}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl h-11 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-600" 
                  onClick={() => navigate("/pricing")}
                >
                  Back to Pricing
                </Button>
                <Button 
                  className="flex-1 bg-[#163BB4] hover:bg-[#0F2D94] text-white rounded-xl h-11 text-xs font-bold shadow-md shadow-blue-900/10" 
                  onClick={() => navigate("/")}
                >
                  Dashboard
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
        
        <div className="text-center text-[10px] text-slate-400 font-medium max-w-xs mx-auto">
          Need help? Contact our support line or email us directly at support@cashbookcharm.com
        </div>
      </div>
    </div>
  );
}

