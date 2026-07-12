import { useMemo, useState } from "react";
import { Plus, Search, TrendingDown, TrendingUp, Loader2, MoreVertical, Copy, ArrowLeftRight, Share2, Trash2, Pencil, Filter, X } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionDialog } from "@/components/TransactionDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useTransactions, useCustomers, type DbTransaction } from "@/hooks/useData";
import { formatDate, formatMoney } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { addOfflineMutation, generateUUID } from "@/lib/offlineSync";

type Filter = "all" | "in" | "out";

export default function Transactions() {
  const { data: transactions, loading, refresh } = useTransactions();
  const { data: customers } = useCustomers();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DbTransaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const categories = useMemo(() => Array.from(new Set(transactions.map((t) => t.category))).filter(Boolean).sort(), [transactions]);
  const methods = useMemo(() => Array.from(new Set(transactions.map((t) => t.payment_method))).filter(Boolean).sort(), [transactions]);

  const list = useMemo(() => {
    return transactions
      .filter((t) => (filter === "all" ? true : t.type === filter))
      .filter((t) => (customerFilter === "all" ? true : t.customer_id === customerFilter))
      .filter((t) => (methodFilter === "all" ? true : t.payment_method === methodFilter))
      .filter((t) => (categoryFilter === "all" ? true : t.category === categoryFilter))
      .filter((t) => (dateFrom ? t.date.slice(0, 10) >= dateFrom : true))
      .filter((t) => (dateTo ? t.date.slice(0, 10) <= dateTo : true))
      .filter((t) => {
        if (!q) return true;
        const cust = customers.find((c) => c.id === t.customer_id)?.name || "";
        return (t.category + " " + (t.note || "") + " " + cust).toLowerCase().includes(q.toLowerCase());
      });
  }, [transactions, customers, q, filter, customerFilter, methodFilter, categoryFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setCustomerFilter("all"); setMethodFilter("all"); setCategoryFilter("all");
    setDateFrom(""); setDateTo(""); setFilter("all"); setQ("");
  };
  const activeFilterCount = [customerFilter !== "all", methodFilter !== "all", categoryFilter !== "all", !!dateFrom, !!dateTo, filter !== "all"].filter(Boolean).length;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    
    let error: any = null;
    let savedOffline = false;

    if (!navigator.onLine) {
      savedOffline = true;
      addOfflineMutation("transactions", "delete", null, id);
    } else {
      try {
        const res = await supabase.from("transactions").delete().eq("id", id);
        error = res.error;
      } catch (err: any) {
        console.warn("Delete failed, caching offline:", err);
        savedOffline = true;
        addOfflineMutation("transactions", "delete", null, id);
      }
    }

    if (error) {
      const msg = error.message || "";
      if (msg.includes("fetch") || msg.includes("NetworkError") || error.status === 0) {
        savedOffline = true;
        addOfflineMutation("transactions", "delete", null, id);
      } else {
        return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      }
    }

    if (savedOffline) {
      toast({
        title: "Deleted locally",
        description: "Your change is saved offline and will sync once internet is restored.",
      });
    } else {
      toast({ title: "Transaction deleted" });
    }
    refresh();
  };

  const handleEdit = (t: DbTransaction) => { setEditing(t); setOpen(true); };
  const handleAdd = () => { setEditing(null); setOpen(true); };

  const handleCopy = async (t: DbTransaction, opposite = false) => {
    const payload = {
      user_id: t.user_id,
      cashbook_id: t.cashbook_id,
      type: opposite ? (t.type === "in" ? "out" : "in") : t.type,
      amount: Number(t.amount),
      category: t.category,
      note: t.note,
      payment_method: t.payment_method,
      customer_id: t.customer_id,
      date: new Date().toISOString(),
    };

    let error: any = null;
    let savedOffline = false;

    if (!navigator.onLine) {
      savedOffline = true;
      const newId = generateUUID();
      addOfflineMutation("transactions", "insert", { ...payload, id: newId });
    } else {
      try {
        const res = await supabase.from("transactions").insert({
          ...payload,
          id: generateUUID(),
        });
        error = res.error;
      } catch (err: any) {
        console.warn("Copy failed, caching offline:", err);
        savedOffline = true;
        const newId = generateUUID();
        addOfflineMutation("transactions", "insert", { ...payload, id: newId });
      }
    }

    if (error) {
      const msg = error.message || "";
      if (msg.includes("fetch") || msg.includes("NetworkError") || error.status === 0) {
        savedOffline = true;
        const newId = generateUUID();
        addOfflineMutation("transactions", "insert", { ...payload, id: newId });
      } else {
        return toast({ title: "Copy failed", description: error.message, variant: "destructive" });
      }
    }

    if (savedOffline) {
      toast({
        title: "Copied locally",
        description: "Your change is saved offline and will sync once internet is restored.",
      });
    } else {
      toast({ title: opposite ? "Opposite entry added" : "Entry copied" });
    }
    refresh();
  };

  const handleShare = (t: DbTransaction) => {
    const text = `${t.type === "in" ? "Cash In" : "Cash Out"}: ${t.category} - ${formatMoney(Number(t.amount))} on ${formatDate(t.date)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground">{list.length} of {transactions.length} entries</p>
        </div>
        <Button onClick={handleAdd} size="lg" className="gap-2 rounded-xl">
          <Plus className="h-4 w-4" />Add Entry
        </Button>
      </header>

      <TransactionDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} onCreated={refresh} editing={editing} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions…" className="h-11 rounded-xl border-border/60 bg-card pl-9" />
        </div>
        <div className="flex h-11 items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
          {(["all", "in", "out"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {f === "all" ? "All" : f === "in" ? "In" : "Out"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)} className="h-11 gap-2 rounded-xl">
          <Filter className="h-4 w-4" />Filters{activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{activeFilterCount}</span>}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-11 gap-1.5 text-muted-foreground"><X className="h-3.5 w-3.5" />Clear</Button>
        )}
      </div>

      {showFilters && (
        <SectionCard className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Customer</label>
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All customers</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Payment method</label>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All methods</SelectItem>{methods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        {loading ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : list.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No transactions match your filters.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {list.map((t) => {
              const cust = customers.find((c) => c.id === t.customer_id);
              const isIn = t.type === "in";
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <button onClick={() => handleEdit(t)} className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isIn ? "bg-[hsl(var(--cash-in)/0.15)] text-[hsl(var(--cash-in))]" : "bg-[hsl(var(--cash-out)/0.15)] text-[hsl(var(--cash-out))]"}`}>
                      {isIn ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.category}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cust && (
                          <Link to={`/customers/${cust.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                            {cust.name}
                          </Link>
                        )}
                        {cust ? " · " : ""}{t.payment_method} · {t.note || (isIn ? "Cash In" : "Cash Out")} · {formatDate(t.date)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded-lg px-2.5 py-1 font-mono text-sm font-bold ${isIn ? "bg-[hsl(var(--cash-in)/0.12)] text-[hsl(var(--cash-in))]" : "bg-[hsl(var(--cash-out)/0.12)] text-[hsl(var(--cash-out))]"}`}>
                      {isIn ? "+" : "−"}{formatMoney(Number(t.amount)).replace("-", "")}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Actions">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => handleEdit(t)}><Pencil className="mr-2 h-4 w-4" />Edit Entry</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopy(t)}><Copy className="mr-2 h-4 w-4" />Copy Entry</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopy(t, true)}><ArrowLeftRight className="mr-2 h-4 w-4" />Copy Opposite</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShare(t)}><Share2 className="mr-2 h-4 w-4" />Share WhatsApp</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(t.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
