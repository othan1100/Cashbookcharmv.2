import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Check, XCircle, ArrowRight, ShieldCheck, BadgeCheck, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";
import { toast } from "@/hooks/use-toast";

interface TransactionDetails {
  code: string;
  status: string;
  paymentType: string;
  amount?: string;
  sid: string;
}

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const [activePlan, setActivePlan] = useState("");
  const [txnDetails, setTxnDetails] = useState<TransactionDetails | null>(null);

  useEffect(() => {
    // Sifalo can return reference inside sid, order_id, or id
    const sid = params.get("sid") ?? params.get("id") ?? "";
    const orderId = params.get("order_id") ?? "";

    if (!sid && !orderId) {
      setState("error");
      setMessage("Missing payment reference (SID/Order ID). Please contact support if you believe this is an error.");
      toast({
        title: "Invalid Payment Reference",
        description: "Missing payment reference. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    let isMounted = true;

    const verifyTransaction = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("sifalo-verify", {
          body: {
            sid: sid || undefined,
            order_id: orderId || undefined
          }
        });

        if (!isMounted) return;

        if (error || !data?.ok) {
          setState("error");
          const errorMsg = data?.error ?? error?.message ?? "Payment verification failed or timed out.";
          setMessage(errorMsg);

          const codeVal = data?.code || "602";
          setTxnDetails({
            code: codeVal,
            status: data?.status || "failed/pending",
            paymentType: data?.payment_type || "Sifalo Pay",
            amount: data?.amount,
            sid: data?.sid || sid || orderId
          });

          toast({
            title: "Payment Pending or Failed",
            description: `${errorMsg} (Sifalo Code: ${codeVal})`,
            variant: "destructive",
          });
          return;
        }

        setState("ok");
        const planName = String(data.plan || "Pro").toUpperCase();
        setActivePlan(planName);
        setMessage(`Your account has been successfully upgraded to the ${planName} plan.`);

        const codeVal = data.code || "601";
        setTxnDetails({
          code: codeVal,
          status: data.status || "success",
          paymentType: data.payment_type || "Sifalo Pay",
          amount: data.amount,
          sid: data.sid || sid || orderId
        });

        toast({
          title: "Payment Completed",
          description: `Transaction verified! Sifalo Code: ${codeVal}. ${planName} unlocked.`,
        });
      } catch (err: any) {
        if (!isMounted) return;
        setState("error");
        const errMsg = err.message || "An unexpected error occurred during verification.";
        setMessage(errMsg);

        setTxnDetails({
          code: "500",
          status: "internal error",
          paymentType: "System Gateway",
          sid: sid || orderId
        });

        toast({
          title: "Verification Error",
          description: errMsg,
          variant: "destructive",
        });
      }
    };

    verifyTransaction();

    return () => {
      isMounted = false;
    };
  }, [params]);

  const handleGoToDashboard = () => {
    // Force page refresh to make sure plan state hook updates cleanly
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-4">
          <div className="flex items-center gap-2 bg-[#163BB4]/10 py-1.5 px-3 rounded-full border border-[#163BB4]/20 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#163BB4]" />
            <span className="text-[10px] font-bold text-[#163BB4] uppercase tracking-wider">
              Sifalo Pay Checkout Protection
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">Cashbook Charm</h2>
        </div>

        <SectionCard className="p-8 shadow-xl border border-slate-200 rounded-3xl bg-white relative overflow-hidden">
          {state === "loading" && (
            <div className="flex flex-col items-center py-6 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-[#163BB4]" />
              <h1 className="text-xl font-extrabold text-slate-800">Verifying Payment...</h1>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                We are securing confirmation of your transaction from Sifalo Pay. This should only take a few seconds.
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
                  {activePlan} UNLOCKED
                </p>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed max-w-sm px-2">
                {message} All premium limits and features have been unlocked immediately.
              </p>

              {txnDetails && (
                <div className="w-full text-left border border-slate-100 bg-slate-50/70 rounded-2xl p-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-100/80 pb-2 flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <ReceiptText className="h-3.5 w-3.5 text-slate-400" /> Payment Receipt
                    </span>
                    <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-black">
                      Code {txnDetails.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Transaction ID</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100/80 px-1.5 py-0.5 rounded break-all inline-block select-all">
                        {txnDetails.sid}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Status</span>
                      <span className="font-bold text-emerald-600">
                        {txnDetails.status.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Gateway</span>
                      <span className="font-medium text-slate-700">
                        {txnDetails.paymentType}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Amount Paid</span>
                      <span className="font-extrabold text-slate-800">
                        {txnDetails.amount ? `$${txnDetails.amount} USD` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full bg-slate-50 border border-slate-150 p-3 rounded-xl text-[11px] text-slate-500 font-medium">
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

              {txnDetails && (
                <div className="w-full text-left border border-slate-100 bg-rose-50/30 rounded-2xl p-4 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-rose-100/40 pb-2 flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      <ReceiptText className="h-3.5 w-3.5 text-slate-400" /> Transaction Error
                    </span>
                    <span className="text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full font-black">
                      Code {txnDetails.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Reference ID</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100/80 px-1.5 py-0.5 rounded break-all inline-block select-all">
                        {txnDetails.sid}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Gateway Status</span>
                      <span className="font-bold text-rose-600">
                        {txnDetails.status.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Gateway</span>
                      <span className="font-medium text-slate-700">
                        {txnDetails.paymentType}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight">Target Amount</span>
                      <span className="font-extrabold text-slate-800">
                        {txnDetails.amount ? `$${txnDetails.amount} USD` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
          Need help? Contact our support line or email us directly at support@cashbookcharm.online
        </div>
      </div>
    </div>
  );
}
