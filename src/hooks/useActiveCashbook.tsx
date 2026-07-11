import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCashbooks } from "@/hooks/useData";

type Ctx = {
  activeId: string | null;
  setActive: (id: string) => Promise<void>;
};

const ActiveCashbookContext = createContext<Ctx>({ activeId: null, setActive: async () => {} });

export function ActiveCashbookProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: cashbooks } = useCashbooks();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setActiveId(null); return; }
    let cancelled = false;
    supabase.from("profiles").select("active_cashbook_id").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const stored = (data as { active_cashbook_id?: string | null } | null)?.active_cashbook_id ?? null;
        setActiveId(stored);
      });
    return () => { cancelled = true; };
  }, [user]);

  // Fallback to first cashbook if none chosen or stored one is gone
  useEffect(() => {
    if (cashbooks.length === 0) return;
    if (!activeId || !cashbooks.find((c) => c.id === activeId)) {
      setActiveId(cashbooks[0].id);
    }
  }, [cashbooks, activeId]);

  const setActive = useCallback(async (id: string) => {
    setActiveId(id);
    if (user) {
      await supabase.from("profiles").update({ active_cashbook_id: id }).eq("user_id", user.id);
    }
  }, [user]);

  const value = useMemo(() => ({ activeId, setActive }), [activeId, setActive]);
  return <ActiveCashbookContext.Provider value={value}>{children}</ActiveCashbookContext.Provider>;
}

export function useActiveCashbook() {
  return useContext(ActiveCashbookContext);
}
