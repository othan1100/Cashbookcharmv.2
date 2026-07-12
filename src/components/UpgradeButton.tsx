import { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface UpgradeButtonProps {
  className?: string;
  onUpgrade?: () => void | Promise<void>;
  planName?: string;
}

export function UpgradeButton({ className, onUpgrade, planName = "Pro" }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Execute custom upgrade callback if provided
      if (onUpgrade) {
        await onUpgrade();
      } else {
        // Default interactive feedback placeholder
        await new Promise((resolve) => setTimeout(resolve, 1200));
        toast({
          title: "Upgrade Initiated",
          description: `You are upgrading to the premium ${planName} plan. Opening checkout page...`,
        });
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      toast({
        title: "Upgrade Failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("relative group inline-block w-full sm:w-auto", className)}>
      {/* Outer ambient glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 rounded-xl blur-md opacity-75 group-hover:opacity-100 transition duration-500 group-hover:duration-200" />
      
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
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span className="bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Preparing Secure Checkout...
            </span>
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
            <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent tracking-tight">
              Upgrade to {planName} Now
            </span>
            <ArrowRight className="h-4 w-4 text-indigo-300 transition-transform duration-300 group-hover:translate-x-1" />
          </>
        )}
      </motion.button>
    </div>
  );
}
