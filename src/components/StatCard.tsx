import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  variant: "cash-in" | "cash-out" | "info" | "neutral";
}

const variantStyles: Record<StatCardProps["variant"], { card: string; iconWrap: string; value: string }> = {
  "cash-in": {
    card: "stat-card stat-card-cash-in",
    iconWrap: "bg-[hsl(var(--cash-in)/0.18)] text-[hsl(var(--cash-in))]",
    value: "text-[hsl(var(--cash-in))]",
  },
  "cash-out": {
    card: "stat-card stat-card-cash-out",
    iconWrap: "bg-[hsl(var(--cash-out)/0.18)] text-[hsl(var(--cash-out))]",
    value: "text-[hsl(var(--cash-out))]",
  },
  info: {
    card: "stat-card stat-card-info",
    iconWrap: "bg-[hsl(var(--info)/0.18)] text-[hsl(var(--info))]",
    value: "text-foreground",
  },
  neutral: {
    card: "stat-card stat-card-neutral",
    iconWrap: "bg-secondary text-foreground",
    value: "text-foreground",
  },
};

export function StatCard({ label, value, icon: Icon, variant }: StatCardProps) {
  const s = variantStyles[variant];
  return (
    <div className={s.card}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:text-xs">{label}</p>
          <p className={cn("mt-2 font-mono text-lg font-bold tracking-tight sm:text-xl md:text-3xl break-all", s.value)}>{value}</p>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl md:h-10 md:w-10", s.iconWrap)}>
          <Icon className="h-4 w-4 md:h-5 md:w-5" />
        </div>
      </div>
    </div>
  );
}
