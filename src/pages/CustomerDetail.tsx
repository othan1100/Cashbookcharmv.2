import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Mail, MessageCircle, Phone, Loader2, TrendingDown, TrendingUp, Share2, Sparkles } from "lucide-react";
import { useCustomers, useTransactions } from "@/hooks/useData";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { generateCustomerStatement } from "@/lib/pdf";
import { useBusinessName } from "@/hooks/useBusinessName";
import { toast } from "@/hooks/use-toast";
import { CustomerImportDialog } from "@/components/CustomerImportDialog";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customers, loading: cLoading } = useCustomers();
  const { data: transactions, loading: tLoading, refresh: refreshTx } = useTransactions();
  const businessName = useBusinessName();
  const [importOpen, setImportOpen] = useState(false);

  const customer = useMemo(() => customers.find((c) => c.id === id), [customers, id]);
  const txs = useMemo(() => transactions.filter((t) => t.customer_id === id), [transactions, id]);
  const balance = useMemo(
    () => txs.reduce((s, t) => s + (t.type === "in" ? Number(t.amount) : -Number(t.amount)), 0),
    [txs],
  );
  const totals = useMemo(() => ({
    cashIn: txs.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0),
    cashOut: txs.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0),
  }), [txs]);

  if (cLoading || tLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/customers")} className="gap-2"><ArrowLeft className="h-4 w-4" />Back</Button>
        <p className="text-sm text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  const positive = balance >= 0;

  const generatePDF = () => {
    if (txs.length === 0) return toast({ title: "No transactions", description: `${customer.name} has no transactions yet.` });
    generateCustomerStatement({
      businessName,
      customer: { name: customer.name, phone: customer.phone, email: customer.email },
      transactions: txs.map((t) => ({
        date: t.date, type: t.type, category: t.category,
        payment_method: t.payment_method, note: t.note, amount: Number(t.amount),
      })),
    });
  };

  const sendWhatsApp = () => {
    if (!customer.phone) return toast({ title: "No phone", description: "Customer has no phone number." });
    const lines = txs.slice(0, 20).map((t) => `${formatDate(t.date)} · ${t.type === "in" ? "+" : "−"}${formatMoney(Number(t.amount))} · ${t.category}`).join("\n");
    const summary = `*${businessName} — Statement*\nCustomer: ${customer.name}\nBalance: ${formatMoney(balance)}\n\n${lines}`;
    window.open(`https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(summary)}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/customers")} className="gap-2 -ml-2"><ArrowLeft className="h-4 w-4" />All customers</Button>

      <SectionCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold uppercase text-primary">
              {customer.name[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{customer.name}</h1>
              {customer.phone && <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" />{customer.phone}</p>}
              {customer.email && <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" />{customer.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className={`font-mono text-3xl font-bold ${positive ? "text-[hsl(var(--cash-in))]" : "text-[hsl(var(--cash-out))]"}`}>
              {positive ? "+" : "−"}{formatMoney(Math.abs(balance)).replace("-", "")}
            </p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Net balance</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {customer.phone && (
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => window.open(`tel:${customer.phone}`)}><Phone className="h-4 w-4" />Call</Button>
          )}
          {customer.phone && (
            <Button variant="outline" className="gap-2 rounded-xl" onClick={sendWhatsApp}><MessageCircle className="h-4 w-4" />WhatsApp</Button>
          )}
          <Button variant="outline" className="gap-2 rounded-xl" onClick={generatePDF}><FileText className="h-4 w-4" />Statement</Button>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={generatePDF}><Share2 className="h-4 w-4" />Export PDF</Button>
          <Button className="gap-2 rounded-xl col-span-2 sm:col-span-4" onClick={() => setImportOpen(true)}>
            <Sparkles className="h-4 w-4" />Import from Image
          </Button>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SectionCard className="p-4"><p className="text-xs uppercase text-muted-foreground">Total Cash In</p><p className="mt-1 font-mono text-xl font-bold text-[hsl(var(--cash-in))]">+{formatMoney(totals.cashIn)}</p></SectionCard>
        <SectionCard className="p-4"><p className="text-xs uppercase text-muted-foreground">Total Cash Out</p><p className="mt-1 font-mono text-xl font-bold text-[hsl(var(--cash-out))]">−{formatMoney(totals.cashOut)}</p></SectionCard>
        <SectionCard className="p-4 col-span-2 md:col-span-1"><p className="text-xs uppercase text-muted-foreground">Transactions</p><p className="mt-1 text-xl font-bold">{txs.length}</p></SectionCard>
      </div>

      <SectionCard title="Transaction history" className="p-5">
        {txs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {txs.map((t) => {
              const isIn = t.type === "in";
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isIn ? "bg-[hsl(var(--cash-in)/0.15)] text-[hsl(var(--cash-in))]" : "bg-[hsl(var(--cash-out)/0.15)] text-[hsl(var(--cash-out))]"}`}>
                      {isIn ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.category}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.payment_method} · {formatDate(t.date)}{t.note ? ` · ${t.note}` : ""}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 font-mono text-sm font-bold ${isIn ? "text-[hsl(var(--cash-in))]" : "text-[hsl(var(--cash-out))]"}`}>
                    {isIn ? "+" : "−"}{formatMoney(Number(t.amount)).replace("-", "")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/transactions" className="hover:underline">View all transactions →</Link>
      </p>

      <CustomerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        customer={customer}
        onSaved={refreshTx}
      />
    </div>
  );
}
