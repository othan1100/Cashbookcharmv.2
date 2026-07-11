import { useState, type ReactNode, type MouseEvent } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";
import { canUseFeature, FEATURES, type FeatureKey } from "@/lib/features";
import { UpgradeRequiredDialog } from "@/components/UpgradeRequiredDialog";
import { PlanBadge } from "@/components/PlanBadge";

interface Props {
  featureKey: FeatureKey;
  children: ReactNode;
  /** Show the lock overlay and intercept clicks. Default: true. */
  intercept?: boolean;
  /** Show the plan badge in the corner. Default: true. */
  showBadge?: boolean;
  className?: string;
}

/**
 * Wrap any clickable feature. If the user's plan can't use it, clicks open the
 * upgrade dialog instead. Locked content stays visible (dimmed) with a badge.
 */
export function LockedFeature({
  featureKey,
  children,
  intercept = true,
  showBadge = true,
  className,
}: Props) {
  const { plan, loading } = usePlan();
  const [open, setOpen] = useState(false);

  if (loading) return <>{children}</>;
  const allowed = canUseFeature(plan, featureKey);
  if (allowed) return <>{children}</>;

  const required = FEATURES[featureKey].requires;

  const handleClick = (e: MouseEvent) => {
    if (!intercept) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <span
        onClickCapture={handleClick}
        className={cn("relative inline-block", className)}
      >
        <span className={intercept ? "pointer-events-none opacity-60" : ""}>
          {children}
        </span>
        {showBadge && (
          <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex items-center gap-0.5">
            <PlanBadge variant={required} />
          </span>
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-background/80 p-1 shadow-sm backdrop-blur-sm">
            <Lock className="h-3 w-3 text-muted-foreground" />
          </span>
        </span>
      </span>
      <UpgradeRequiredDialog open={open} onOpenChange={setOpen} featureKey={featureKey} />
    </>
  );
}

/**
 * Hook variant: returns { allowed, gate } where `gate(onClick)` wraps a handler.
 * Use when you can't wrap children (e.g. a hidden file input).
 */
export function useFeatureGate(featureKey: FeatureKey) {
  const { plan, loading } = usePlan();
  const [open, setOpen] = useState(false);
  const allowed = loading || canUseFeature(plan, featureKey);

  const guard = <T extends (...args: never[]) => unknown>(fn: T) => {
    return ((...args: Parameters<T>) => {
      if (!allowed) {
        setOpen(true);
        return;
      }
      return fn(...args);
    }) as T;
  };

  const dialog = (
    <UpgradeRequiredDialog open={open} onOpenChange={setOpen} featureKey={featureKey} />
  );

  return { allowed, guard, open, setOpen, dialog };
}
