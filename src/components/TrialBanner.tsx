import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";

export function TrialBanner() {
  const { onTrial, trialDaysLeft } = usePlan();
  const [dismissed, setDismissed] = useState(false);
  if (!onTrial || dismissed) return null;

  const urgent = trialDaysLeft <= 3;
  return (
    <div className={`flex flex-wrap items-center gap-3 border-b px-3 py-2 text-sm md:px-6 ${urgent ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-primary/10 text-primary border-primary/20"}`}>
      <Sparkles className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0 font-medium">
        Your Pro Trial expires in <strong>{trialDaysLeft}</strong> {trialDaysLeft === 1 ? "day" : "days"}. Upgrade to keep premium features.
      </span>
      <Link to="/pricing?highlight=pro" className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90">
        Upgrade now
      </Link>
      <button aria-label="Dismiss" onClick={() => setDismissed(true)} className="rounded-md p-1 opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
