import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, ArrowRight, RotateCcw, ShieldCheck, ReceiptText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";
import { toast } from "@/hooks/use-toast";

interface CancelDetails {
  orderId: string;
  status: string;
}

export default function PaymentCancelled() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [details, setDetails] = useState<CancelDetails | null>(null);
  const [marking, setMarking] = useState(false);

  const orderId = params.get("order_id") ?? params.get("sid") ?? "";

  useEffect(() => {
    document.title = "Payment Cancelled — Cashbook Charm";

    if (!orderId) {
      setDetails({ orderId: "", status: "cancelled" });
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        // Mark the subscription as cancelled so the verify endpoint
        // doesn't keep polling Sifalo for a payment that won't arrive.
        const { data, error } = await supabase.functions.invoke("sifalo-verify", {
          body: { order_id: orderId },
        });

        if (!isMounted) return;

        if (error) {
          setDetails({ orderId, status: "cancelled" });
          return;
        }

        // If verify says it's cancelled or failed, reflect that.
        // If verify somehow says ok (user paid after all), redirect to success.
        if (data?.ok) {
          toast({
            title: "Payment Detected",
            description: "Your payment was actually completed. Redirecting...",
          });
          navigate("/payment-success?order_id=" + encodeURIComponent(orderId), {
            replace: true,
          });
          return;
        }

        setDetails({
          orderId,
          status: data?.cancelled ? "cancelled" : data?.status || "cancelled",
        });
      } catch {
        if (!isMounted) return;
        setDetails({ orderId, status: "cancelled" });
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleRetry = () => {
    if (marking) return;
    setMarking(true);
    navigate("/pricing");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-4">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-4">
          <div className="flex items-center gap-2 bg-rose-50 py-1.5 px-3 rounded-full border border-rose-200 mb-2">
            <ShieldCheck className="h-4 w-4 text-rose-500" />
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
              Sifalo Pay Checkout
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            Cashbook Charm
          </h2>
        </div>

        <SectionCard className="p-8 shadow-xl border border-slate-200 rounded-3xl bg-white relative overflow-hidden">
          <div className="flex flex-col items-center py-4 text-center space-y-5 animate-fadeIn">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-inner">
              <XCircle className="h-10 w-10" strokeWidth={2.5} />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Payment Cancelled
              </h1>
              <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">
                No Charge Was Made
              </p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed max-w-sm px-2">
              Your checkout was cancelled and no payment was processed. Your
              account remains on its current plan. You can try again whenever
              you're ready — your cashbook data is safe.
            </p>

            {details?.orderId && (
              <div className="w-full text-left border border-slate-100 bg-slate-50/70 rounded-2xl p-4 space-y-3">
                <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-100/80 pb-2 flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <ReceiptText className="h-3.5 w-3.5 text-slate-400" />{" "}
                    Order Reference
                  </span>
                  <span className="text-rose-500 bg-rose-50 px-2.5 py-0.5 rounded-full font-black">
                    Cancelled
                  </span>
                </div>

                <div className="text-xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-tight mb-1">
                    Reference ID
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100/80 px-1.5 py-0.5 rounded break-all inline-block select-all">
                    {details.orderId}
                  </span>
                </div>
              </div>
            )}

            <div className="w-full bg-amber-50 border border-amber-100 p-3 rounded-xl text-[11px] text-amber-700 font-medium">
              You were not charged. Feel free to start a new checkout at any
              time.
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11 text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-600"
                onClick={() => navigate("/")}
              >
                Back to Dashboard
              </Button>
              <Button
                className="flex-1 bg-[#163BB4] hover:bg-[#0F2D94] text-white rounded-xl h-11 text-xs font-bold shadow-md shadow-blue-900/10 gap-2"
                onClick={handleRetry}
                disabled={marking}
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="text-center text-[10px] text-slate-400 font-medium max-w-xs mx-auto">
          Need help? Contact our support line or email us directly at
          support@cashbookcharm.com
        </div>
      </div>
    </div>
  );
}
