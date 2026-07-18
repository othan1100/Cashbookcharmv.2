import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface UpgradeButtonProps {
  className?: string;
  planName?: string;
  planId?: string;
  billingCycle?: "monthly" | "yearly";
}

export function UpgradeButton({
  className,
  planName = "Pro",
  planId = "pro",
  billingCycle = "monthly",
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (loading) return;
    setLoading(true);
    toast({
      title: "Redirecting to checkout",
      description: `Preparing secure Sifalo Pay checkout for the ${planName} plan...`,
    });
    navigate(`/checkout?plan=${planId}&cycle=${billingCycle}`);
  };

  return (
    <div className={cn("relative group inline-block w-full sm:w-auto", className)}>
      {/* Outer ambient glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-xl blur-md opacity-75 group-hover:opacity-100 transition duration-500 group-hover:duration-200" />

      <motion.button
        type="button"
        disabled={loading}
        onClick={handleUpgrade}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative flex items-center justify-center gap-2.5 w-full sm:w-auto px-6 py-3.5",
          "bg-slate-950 text-white font-semibold text-sm rounded-xl border border-white/10",
          "shadow-2xl overflow-hidden transition-all duration-300",
          "disabled:opacity-85 disabled:pointer-events-none"
        )}
      >
        {/* Animated slide background shine */}
        <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Preparing Secure Checkout...
            </span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
            <span className="bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent tracking-tight">
              Upgrade to {planName} Now
            </span>
            <ArrowRight className="h-4 w-4 text-blue-300 transition-transform duration-300 group-hover:translate-x-1" />
          </>
        )}
      </motion.button>
    </div>
  );
}
