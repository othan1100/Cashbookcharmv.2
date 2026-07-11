import { useNavigate } from "react-router-dom";
import { Check, Crown, Lock, Sparkles, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlanBadge } from "@/components/PlanBadge";
import { FEATURES, type FeatureKey } from "@/lib/features";
import { usePlan } from "@/hooks/usePlan";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  featureKey: FeatureKey;
}

export function UpgradeRequiredDialog({ open, onOpenChange, featureKey }: Props) {
  const navigate = useNavigate();
  const { plan } = usePlan();
  const f = FEATURES[featureKey];
  const Icon = f.requires === "team" ? Users : Crown;

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate(`/pricing?highlight=${f.requires}&from=${f.key}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Icon className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <DialogHeader className="mt-4 text-left">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-xl">{f.name}</DialogTitle>
              <PlanBadge variant={f.requires} size="md" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <Lock className="mr-1 inline h-3 w-3" />
              Available on the {f.requires === "team" ? "Team" : "Pro"} plan
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <ul className="space-y-2.5">
            {f.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/50 px-3 py-2.5 text-xs">
            <div>
              <p className="text-muted-foreground">Your plan</p>
              <p className="font-semibold capitalize">{plan}</p>
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="text-right">
              <p className="text-muted-foreground">Required</p>
              <p className="font-semibold capitalize">{f.requires}</p>
            </div>
          </div>

          <Button onClick={handleUpgrade} className="w-full gap-2 rounded-xl" size="lg">
            <Sparkles className="h-4 w-4" />
            Upgrade to {f.requires === "team" ? "Team" : "Pro"}
          </Button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
