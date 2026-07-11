import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, TrendingUp, TrendingDown, Activity, Wallet, Loader2, Pencil } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "@/components/TransactionDialog";
import { useTransactions, useCustomers, type DbTransaction } from "@/hooks/useData";
import { formatMoney, formatDate } from "@/lib/format";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const PIE_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-3))"];

export default function Dashboard() {
  const { data: transactions, loading, refresh } = useTransactions();
  const { data: customers } = useCustomers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbTransaction | null>(null);

  const stats = useMemo(() => {
    const cashIn = transactions.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0);
    const cashOut = transactions.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0);
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayNet = transactions
      .filter((t) => t.date.slice(0, 10) === todayKey)
      .reduce((s, t) => s + (t.type === "in" ? Number(t.amount) : -Number(t.amount)), 0);
    return { cashIn, cashOut, todayNet, balance: cashIn - cashOut };
  }, [transactions]);

  const last7 = useMemo(() => Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const key = date.toISOString().slice(0, 10);
    const dayTx = transactions.filter((t) => t.date.slice(0, 10) === key);
    return {
      day: date.toLocaleDateString("en", { weekday: "short" }),
      in: dayTx.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0),
      out: dayTx.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0),
    };
  }), [transactions]);

  const flow = useMemo(() => {
    let running = 0;
    return Array.from({ length: 14 }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      const key = date.toISOString().slice(0, 10);
      const net = transactions.filter((t) => t.date.slice(0, 10) === key)
        .reduce((s, t) => s + (t.type === "in" ? Number(t.amount) : -Number(t.amount)), 0);
      running += net;
      return { date: date.toLocaleDateString("en", { day: "2-digit", month: "short" }), balance: running };
    });
  }, [transactions]);

  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter((t) => t.type === "in").forEach((t) => map.set(t.category, (map.get(t.category) || 0) + Number(t.amount)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const recent = transactions.slice(0, 5);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Today's financial overview</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} size="lg" className="gap-2 rounded-xl">
          <Plus className="h-4 w-4" />Add Entry
        </Button>
      </header>
      <TransactionDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }} onCreated={refresh} editing={editing} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cash In" value={formatMoney(stats.cashIn)} icon={TrendingUp} variant="cash-in" />
        <StatCard label="Cash Out" value={formatMoney(stats.cashOut)} icon={TrendingDown} variant="cash-out" />
        <StatCard label="Today Net" value={formatMoney(stats.todayNet)} icon={Activity} variant="info" />
        <StatCard label="Total Balance" value={formatMoney(stats.balance)} icon={Wallet} variant="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Last 7 Days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7} barCategoryGap={16}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                <Bar dataKey="in" fill="hsl(var(--cash-in))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="out" fill="hsl(var(--cash-out))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Spending by Category">
          <div className="h-64">
            {pieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {pieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Cash Flow Trend (14 Days)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={flow}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Line type="monotone" dataKey="balance" stroke="hsl(var(--info))" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "hsl(var(--info))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Recent Transactions">
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet. Add your first entry!</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {recent.map((t, idx) => {
              const cust = customers.find((c) => c.id === t.customer_id);
              const isIn = t.type === "in";
              const isLatest = idx === 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isIn ? "bg-[hsl(var(--cash-in)/0.15)] text-[hsl(var(--cash-in))]" : "bg-[hsl(var(--cash-out)/0.15)] text-[hsl(var(--cash-out))]"}`}>
                      {isIn ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {t.category}
                        {isLatest && <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">Latest</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cust ? <Link to={`/customers/${cust.id}`} className="text-primary hover:underline">{cust.name}</Link> : null}
                        {cust ? " · " : ""}{t.note || (isIn ? "Cash In" : "Cash Out")} · {formatDate(t.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 font-mono text-sm font-bold ${isIn ? "text-[hsl(var(--cash-in))]" : "text-[hsl(var(--cash-out))]"}`}>
                      {isIn ? "+" : "−"}{formatMoney(Number(t.amount)).replace("-", "")}
                    </span>
                    <button onClick={() => { setEditing(t); setDialogOpen(true); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-3 text-center">
          <Link to="/transactions" className="text-xs font-semibold text-primary hover:underline">View all transactions →</Link>
        </div>
      </SectionCard>
    </div>
  );
}
