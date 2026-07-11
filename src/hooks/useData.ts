import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCashbook } from "@/hooks/useActiveCashbook";

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
  const [data, setData] = useState<DbCashbook[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("cashbooks")
      .select("*")
      .order("created_at", { ascending: true });
    setData((rows as DbCashbook[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

/**
 * Returns transactions scoped to the currently active cashbook.
 * Pass `scope: "all"` to return every transaction across cashbooks (for admin views).
 */
export function useTransactions(opts: { scope?: "active" | "all" } = {}) {
  const { user } = useAuth();
  const { activeId } = useActiveCashbook();
  const scope = opts.scope ?? "active";
  const [data, setData] = useState<DbTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (scope === "active" && !activeId) { setData([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase.from("transactions").select("*").order("date", { ascending: false });
    if (scope === "active" && activeId) q = q.eq("cashbook_id", activeId);
    const { data: rows } = await q;
    setData((rows as DbTransaction[]) || []);
    setLoading(false);
  }, [user, activeId, scope]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useCustomers(opts: { scope?: "active" | "all" } = {}) {
  const { user } = useAuth();
  const { activeId } = useActiveCashbook();
  const scope = opts.scope ?? "active";
  const [data, setData] = useState<DbCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    if (scope === "active" && !activeId) { setData([]); setLoading(false); return; }
    setLoading(true);
    let q = supabase.from("customers").select("*").order("name", { ascending: true });
    if (scope === "active" && activeId) q = q.eq("cashbook_id", activeId);
    const { data: rows } = await q;
    setData((rows as DbCustomer[]) || []);
    setLoading(false);
  }, [user, activeId, scope]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}
