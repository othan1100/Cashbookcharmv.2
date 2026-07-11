import { useMemo, useState } from "react";
import { Download, TrendingDown, TrendingUp, DollarSign, Hash, Loader2, Lock } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { useTransactions, useCustomers } from "@/hooks/useData";
import { useFeatureGate } from "@/components/LockedFeature";
import { PlanBadge } from "@/components/PlanBadge";
import { usePlan } from "@/hooks/usePlan";
import { formatMoney } from "@/lib/format";
import { generateBusinessReport } from "@/lib/pdf";
import { useBusinessName } from "@/hooks/useBusinessName";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const PAYMENT_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

type Period = "day" | "week" | "month" | "30d" | "90d" | "year";
// Starter plan: daily/weekly/monthly (up to 30 days). Pro/Team: all periods.
const PERIODS: { value: Period; label: string; proOnly: boolean }[] = [
  { value: "day", label: "Today", proOnly: false },
  { value: "week", label: "Last 7 days", proOnly: false },
  { value: "month", label: "This month", proOnly: false },
  { value: "30d", label: "Last 30 days", proOnly: false },
  { value: "90d", label: "Last 90 days", proOnly: true },
  { value: "year", label: "This year", proOnly: true },
];

function periodStart(p: Period): Date {
  const now = new Date();
  const d = new Date(now);
  switch (p) {
    case "day": d.setHours(0, 0, 0, 0); return d;
    case "week": d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d;
    case "month": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "30d": d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d;
    case "90d": d.setDate(d.getDate() - 89); d.setHours(0, 0, 0, 0); return d;
    case "year": return new Date(now.getFullYear(), 0, 1);
  }
}

export default function Reports() {
  const { data: allTransactions, loading } = useTransactions();
  const { data: customers } = useCustomers();
  const businessName = useBusinessName();
  const pdfGate = useFeatureGate("pdf_export");
  const advancedGate = useFeatureGate("advanced_reports");
  const { plan } = usePlan();
  const isStarter = plan === "starter";
  const [period, setPeriod] = useState<Period>("month");

  const transactions = useMemo(() => {
    const start = periodStart(period).getTime();
    return allTransactions.filter((t) => new Date(t.date).getTime() >= start);
  }, [allTransactions, period]);

  const totals = useMemo(() => {
    const cashIn = transactions.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0);
    const cashOut = transactions.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0);
    return { cashIn, cashOut, net: cashIn - cashOut };
  }, [transactions]);

  const monthly = useMemo(() => Array.from({ length: 6 }).map((_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthTx = transactions.filter((t) => t.date.slice(0, 7) === key);
    const cashIn = monthTx.filter((t) => t.type === "in").reduce((s, t) => s + Number(t.amount), 0);
    const cashOut = monthTx.filter((t) => t.type === "out").reduce((s, t) => s + Number(t.amount), 0);
    return { month: date.toLocaleDateString("en", { month: "short", year: "2-digit" }), cashIn, cashOut, profit: cashIn - cashOut };
  }), [transactions]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => map.set(t.category, (map.get(t.category) || 0) + Number(t.amount)));
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const paymentData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => map.set(t.payment_method, (map.get(t.payment_method) || 0) + Number(t.amount)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const customerVolume = useMemo(() => {
    return customers
      .map((c) => ({ ...c, volume: transactions.filter((t) => t.customer_id === c.id).reduce((s, t) => s + Number(t.amount), 0) }))
      .filter((c) => c.volume > 0)
      .sort((a, b) => b.volume - a.volume);
  }, [customers, transactions]);
  const maxVol = Math.max(...customerVolume.map((c) => c.volume), 1);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isStarter ? "Starter plan — daily, weekly & monthly up to 30 days. Upgrade for 90 days & yearly." : "Financial insights & analytics"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={period}
            onChange={(e) => {
              const next = e.target.value as Period;
              const def = PERIODS.find((p) => p.value === next);
              if (def?.proOnly && isStarter) { advancedGate.setOpen(true); return; }
              setPeriod(next);
            }}
            className="h-10 rounded-xl border border-border/60 bg-card px-3 text-sm font-medium"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}{p.proOnly && isStarter ? " 🔒" : ""}</option>
            ))}
          </select>
          {advancedGate.dialog}
          {(() => {
            // Starter: PDF allowed only for "This month" (≤30 days) and "Last 30 days".
            // Pro/Team: allowed for every period.
            const starterPdfAllowed = period === "month" || period === "30d";
            const canDownload = isStarter ? starterPdfAllowed : true;
            return (
              <Button
                variant="default"
                className="gap-2 rounded-xl"
                onClick={canDownload
                  ? () => generateBusinessReport({ businessName, transactions, customers })
                  : pdfGate.guard(() => generateBusinessReport({ businessName, transactions, customers }))}
              >
                {canDownload ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                Download PDF
                {!canDownload && <PlanBadge variant="pro" />}
              </Button>
            );
          })()}
          {pdfGate.dialog}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cash In" value={formatMoney(totals.cashIn)} icon={TrendingUp} variant="cash-in" />
        <StatCard label="Cash Out" value={formatMoney(totals.cashOut)} icon={TrendingDown} variant="cash-out" />
        <StatCard label="Net Profit" value={formatMoney(totals.net)} icon={DollarSign} variant="cash-in" />
        <StatCard label="Transactions" value={String(transactions.length)} icon={Hash} variant="info" />
      </div>

      <SectionCard title="Monthly Trend (6 Months)">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="cashIn" name="Cash In" stroke="hsl(var(--cash-in))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="cashOut" name="Cash Out" stroke="hsl(var(--cash-out))" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--info))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="By Category">
          <div className="h-64">
            {categoryData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={120} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard title="By Payment Method">
          <div className="h-64">
            {paymentData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88} paddingAngle={3}>
                    {paymentData.map((_, i) => (<Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Top Customers by Volume">
        {customerVolume.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No customer transactions yet.</p>
        ) : (
          <ol className="space-y-4">
            {customerVolume.map((c, i) => (
              <li key={c.id} className="flex items-center gap-4">
                <span className="w-5 text-sm font-semibold text-muted-foreground">{i + 1}.</span>
                <div className="flex-1">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-semibold">{c.name}</p>
                    <p className="font-mono text-sm font-bold">{formatMoney(c.volume)}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(c.volume / maxVol) * 100}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}
