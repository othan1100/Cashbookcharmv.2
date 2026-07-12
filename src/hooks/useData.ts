import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCashbook } from "@/hooks/useActiveCashbook";
import {
  getOfflineCache,
  setOfflineCache,
  mergePendingMutations
} from "@/lib/offlineSync";

export type DbTransaction = {
  id: string;
  user_id: string;
  cashbook_id: string;
  customer_id: string | null;
  type: "in" | "out";
  amount: number;
  category: string;
  note: string | null;
  payment_method: "Cash" | "Card" | "Bank" | "Mobile";
  date: string;
  created_at: string;
  attachment_url: string | null;
};

export type DbCustomer = {
  id: string;
  user_id: string;
  cashbook_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  balance: number;
};

export type DbCashbook = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
};

export function useCashbooks() {
  const { user } = useAuth();
  const [data, setData] = useState<DbCashbook[]>(() => {
    const cached = getOfflineCache<DbCashbook>("cashbooks");
    return mergePendingMutations("cashbooks", cached);
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("cashbooks")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      const items = (rows as DbCashbook[]) || [];
      setOfflineCache("cashbooks", items);
      setData(mergePendingMutations("cashbooks", items));
    } catch (e) {
      console.warn("Offline fallback for cashbooks:", e);
      const cached = getOfflineCache<DbCashbook>("cashbooks");
      setData(mergePendingMutations("cashbooks", cached));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleMutationsChanged = () => {
      const cached = getOfflineCache<DbCashbook>("cashbooks");
      setData(mergePendingMutations("cashbooks", cached));
    };
    window.addEventListener("offline_mutations_changed", handleMutationsChanged);
    return () => window.removeEventListener("offline_mutations_changed", handleMutationsChanged);
  }, []);

  return { data, loading, refresh };
}

export function useTransactions(opts: { scope?: "active" | "all" } = {}) {
  const { user } = useAuth();
  const { activeId } = useActiveCashbook();
  const scope = opts.scope ?? "active";
  
  const getLocalFilteredTransactions = useCallback(() => {
    const cached = getOfflineCache<DbTransaction>("transactions");
    const merged = mergePendingMutations("transactions", cached);
    if (scope === "active" && activeId) {
      return merged.filter((t) => t.cashbook_id === activeId);
    }
    return merged;
  }, [scope, activeId]);

  const [data, setData] = useState<DbTransaction[]>(getLocalFilteredTransactions);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (scope === "active" && !activeId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let q = supabase.from("transactions").select("*").order("date", { ascending: false });
      if (scope === "active" && activeId) q = q.eq("cashbook_id", activeId);
      const { data: rows, error } = await q;

      if (error) throw error;

      const items = (rows as DbTransaction[]) || [];
      
      if (scope === "active" && activeId) {
        const fullCache = getOfflineCache<DbTransaction>("transactions");
        const otherCashbooks = fullCache.filter((t) => t.cashbook_id !== activeId);
        const updatedCache = [...items, ...otherCashbooks];
        setOfflineCache("transactions", updatedCache);
      } else {
        setOfflineCache("transactions", items);
      }

      setData(mergePendingMutations("transactions", items));
    } catch (e) {
      console.warn("Offline fallback for transactions:", e);
      setData(getLocalFilteredTransactions());
    } finally {
      setLoading(false);
    }
  }, [user, activeId, scope, getLocalFilteredTransactions]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleMutationsChanged = () => {
      setData(getLocalFilteredTransactions());
    };
    window.addEventListener("offline_mutations_changed", handleMutationsChanged);
    return () => window.removeEventListener("offline_mutations_changed", handleMutationsChanged);
  }, [getLocalFilteredTransactions]);

  return { data, loading, refresh };
}

export function useCustomers(opts: { scope?: "active" | "all" } = {}) {
  const { user } = useAuth();
  const { activeId } = useActiveCashbook();
  const scope = opts.scope ?? "active";

  const getLocalFilteredCustomers = useCallback(() => {
    const cached = getOfflineCache<DbCustomer>("customers");
    const merged = mergePendingMutations("customers", cached);
    if (scope === "active" && activeId) {
      return merged.filter((c) => c.cashbook_id === activeId);
    }
    return merged;
  }, [scope, activeId]);

  const [data, setData] = useState<DbCustomer[]>(getLocalFilteredCustomers);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (scope === "active" && !activeId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let q = supabase.from("customers").select("*").order("name", { ascending: true });
      if (scope === "active" && activeId) q = q.eq("cashbook_id", activeId);
      const { data: rows, error } = await q;

      if (error) throw error;

      const items = (rows as DbCustomer[]) || [];
      
      if (scope === "active" && activeId) {
        const fullCache = getOfflineCache<DbCustomer>("customers");
        const otherCashbooks = fullCache.filter((c) => c.cashbook_id !== activeId);
        const updatedCache = [...items, ...otherCashbooks];
        setOfflineCache("customers", updatedCache);
      } else {
        setOfflineCache("customers", items);
      }

      setData(mergePendingMutations("customers", items));
    } catch (e) {
      console.warn("Offline fallback for customers:", e);
      setData(getLocalFilteredCustomers());
    } finally {
      setLoading(false);
    }
  }, [user, activeId, scope, getLocalFilteredCustomers]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleMutationsChanged = () => {
      setData(getLocalFilteredCustomers());
    };
    window.addEventListener("offline_mutations_changed", handleMutationsChanged);
    return () => window.removeEventListener("offline_mutations_changed", handleMutationsChanged);
  }, [getLocalFilteredCustomers]);

  return { data, loading, refresh };
}
