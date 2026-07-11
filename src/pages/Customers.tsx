import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, FileText, Mail, MessageCircle, MoreVertical, Phone, Search, UserPlus, Loader2, Pencil, Trash2, Share2, Lock } from "lucide-react";
import { ReminderDialog, type ReminderCustomer } from "@/components/ReminderDialog";
import { EditCustomerDialog } from "@/components/CustomerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCustomers, useCashbooks, useTransactions, type DbCustomer } from "@/hooks/useData";
import { useActiveCashbook } from "@/hooks/useActiveCashbook";
import { useFeatureGate } from "@/components/LockedFeature";
import { PlanBadge } from "@/components/PlanBadge";
import { formatMoney } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { generateCustomerStatement } from "@/lib/pdf";
import { useBusinessName } from "@/hooks/useBusinessName";

export default function Customers() {
  const { user } = useAuth();
  const { data: customers, loading, refresh } = useCustomers();
  const { data: cashbooks } = useCashbooks();
  const { activeId } = useActiveCashbook();
  const { data: transactions } = useTransactions();
  const businessName = useBusinessName();
  const reminderGate = useFeatureGate("customer_reminders");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<{ customer: ReminderCustomer; balance: number } | null>(null);
  const [editing, setEditing] = useState<DbCustomer | null>(null);

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (!t.customer_id) continue;
      const cur = map.get(t.customer_id) ?? 0;
      const amt = Number(t.amount);
      map.set(t.customer_id, cur + (t.type === "in" ? amt : -amt));
    }
    return map;
  }, [transactions]);

  const list = useMemo(
    () => customers.filter((c) => (c.name + (c.phone ?? "") + (c.email ?? "")).toLowerCase().includes(q.toLowerCase())),
    [customers, q],
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashbookId = activeId || cashbooks[0]?.id;
    if (!user || !cashbookId) return;
    setBusy(true);
    const { error } = await supabase.from("customers").insert({
      user_id: user.id, cashbook_id: cashbookId, name,
      phone: phone || null, email: email || null, balance: 0,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    toast({ title: "Customer added" });
    setOpen(false);
    setName(""); setPhone(""); setEmail("");
    refresh();
  };

  const handleDelete = async (c: DbCustomer) => {
    if (!confirm(`Delete customer "${c.name}"? This does not delete their transactions.`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Customer deleted" });
    refresh();
  };

  const downloadStatement = (c: DbCustomer) => {
    const txs = transactions.filter((t) => t.customer_id === c.id);
    if (txs.length === 0) return toast({ title: "No transactions", description: `${c.name} has no transactions yet.` });
    generateCustomerStatement({
      businessName,
      customer: { name: c.name, phone: c.phone, email: c.email },
      transactions: txs.map((t) => ({
        date: t.date, type: t.type, category: t.category,
        payment_method: t.payment_method, note: t.note, amount: Number(t.amount),
      })),
    });
  };

  const sendWhatsAppStatement = (c: DbCustomer, bal: number) => {
    if (!c.phone) return toast({ title: "No phone", description: "Customer has no phone number." });
    const txs = transactions.filter((t) => t.customer_id === c.id).slice(0, 10);
    const lines = txs.map((t) => `${new Date(t.date).toLocaleDateString()} · ${t.type === "in" ? "+" : "−"}${formatMoney(Number(t.amount))} · ${t.category}`).join("\n");
    const msg = `*${businessName} — Statement*\n${c.name}\nBalance: ${formatMoney(bal)}\n\n${lines}`;
    window.open(`https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">{customers.length} customers</p>
        </div>
        <Button onClick={() => setOpen(true)} size="lg" className="gap-2 rounded-xl">
          <UserPlus className="h-4 w-4" />Add Customer
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Customer</DialogTitle>
              <p className="text-sm text-muted-foreground">Add a customer to track balances and send statements.</p>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +252 61 0000000" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" /></div>
              <Button type="submit" className="w-full rounded-xl" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Customer"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, or email…" className="h-11 rounded-xl border-border/60 bg-card pl-9" />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : list.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No customers yet. Add your first one!</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
          {list.map((c) => {
            const bal = balances.get(c.id) ?? Number(c.balance);
            const positive = bal >= 0;
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/customers/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold uppercase text-primary">
                    {c.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.phone || c.email || "—"}
                    </p>
                  </div>
                </Link>
                <div className="text-right">
                  <p className={`font-mono text-sm font-bold ${positive ? "text-[hsl(var(--cash-in))]" : "text-[hsl(var(--cash-out))]"}`}>
                    {positive ? "+" : "−"}{formatMoney(Math.abs(bal)).replace("-", "")}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Actions">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild><Link to={`/customers/${c.id}`}><FileText className="mr-2 h-4 w-4" />View history</Link></DropdownMenuItem>
                    <DropdownMenuItem onClick={() => c.phone && window.open(`tel:${c.phone}`)} disabled={!c.phone}><Phone className="mr-2 h-4 w-4" />Call</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => c.phone && window.open(`https://wa.me/${c.phone.replace(/\D/g, "")}`, "_blank")} disabled={!c.phone}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => sendWhatsAppStatement(c, bal)} disabled={!c.phone}><Share2 className="mr-2 h-4 w-4" />WhatsApp statement</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const subject = encodeURIComponent(`${businessName} — Account update`);
                      const body = encodeURIComponent(`Hi ${c.name},\n\nYour current balance with us is ${formatMoney(bal)}.\n\nThank you,\n${businessName}`);
                      window.location.href = `mailto:${c.email ?? ""}?subject=${subject}&body=${body}`;
                    }}><Mail className="mr-2 h-4 w-4" />Email{!c.email && <span className="ml-auto text-[10px] text-muted-foreground">no addr</span>}</DropdownMenuItem>
                    <DropdownMenuItem onClick={reminderGate.guard(() => { setReminderTarget({ customer: { id: c.id, name: c.name, phone: c.phone, email: c.email }, balance: bal }); setReminderOpen(true); })}>
                      {reminderGate.allowed ? <Bell className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                      Send reminder
                      {!reminderGate.allowed && <span className="ml-auto"><PlanBadge variant="pro" /></span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadStatement(c)}><FileText className="mr-2 h-4 w-4" />Download statement (PDF)</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setEditing(c)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(c)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <ReminderDialog open={reminderOpen} onOpenChange={setReminderOpen} customer={reminderTarget?.customer ?? null} amountDue={reminderTarget?.balance ?? 0} onMarkedPaid={refresh} />
      <EditCustomerDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} customer={editing} onSaved={refresh} />
      {reminderGate.dialog}
    </div>
  );
}
