import { BookOpen, Check, ChevronDown, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCashbooks } from "@/hooks/useData";
import { useActiveCashbook } from "@/hooks/useActiveCashbook";

export function CashbookSwitcher() {
  const { data: cashbooks } = useCashbooks();
  const { activeId, setActive } = useActiveCashbook();
  const active = cashbooks.find((c) => c.id === activeId) || cashbooks[0];
  if (!active) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs sm:text-sm font-medium hover:bg-secondary max-w-[180px]">
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">{active.name}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Your Cashbooks</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {cashbooks.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => setActive(c.id)} className="flex items-center justify-between gap-2">
            <span className="truncate">{c.name}</span>
            {c.id === active.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/cashbooks" className="flex items-center gap-2"><Plus className="h-4 w-4" /> Manage cashbooks</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
