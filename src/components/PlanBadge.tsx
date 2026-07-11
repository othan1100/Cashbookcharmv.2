import { Crown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "pro" | "team";

interface Props {
  variant: Variant;
  className?: string;
  size?: "sm" | "md";
}

export function PlanBadge({ variant, className, size = "sm" }: Props) {
  const Icon = variant === "team" ? Users : Crown;
  const label = variant === "team" ? "Team" : "Pro";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider",
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
        variant === "pro"
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          : "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        className,
      )}
    >
      <Icon className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} strokeWidth={2.5} />
      {label}
    </span>
  );
}
