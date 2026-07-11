import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp, Users, DollarSign, BookOpen } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";

type ProfileRow = { user_id: string; plan_type: string; created_at: string };
type TxRow = { id: string; type: string; amount: number; date: string };

const PLAN_COLORS: Record<string, string> = {
  starter: "hsl(var(--muted-foreground))",
  pro: "hsl(var(--primary))",
  team: "hsl(var(--cash-in))",
};

export function AdminInsights() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: t }] = await Promise.all([
        supabase.from("profiles").select("user_id,plan_type,created_at"),
        supabase.from("transactions").select("id,type,amount,date").order("date", { ascending: false }).limit(2000),
      ]);
      setProfiles((p as ProfileRow[]) || []);
      setTransactions((t as TxRow[]) || []);
      setLoading(false);
    })();
  }, []);

  const signupTrend = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return { date: d.toLocaleDateString("en", { month: "short", day: "numeric" }), key, signups: 0 };
    });
    profiles.forEach((p) => {
      const k = p.created_at.slice(0, 10);
      const slot = days.find((d) => d.key === k);
      if (slot) slot.signups++;
    });
    return days.map(({ date, signups }) => ({ date, signups }));
  }, [profiles]);

  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = { starter: 0, pro: 0, team: 0 };
    profiles.forEach((p) => { counts[p.plan_type] = (counts[p.plan_type] || 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [profiles]);

  const cashTrend = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return { date: d.toLocaleDateString("en", { month: "short", day: "numeric" }), key, cashIn: 0, cashOut: 0 };
    });
    transactions.forEach((t) => {
      const k = t.date.slice(0, 10);
      const slot = days.find((d) => d.key === k);
      if (!slot) return;
      if (t.type === "in") slot.cashIn += Number(t.amount);
      else slot.cashOut += Number(t.amount);
    });
    return days.map(({ date, cashIn, cashOut }) => ({ date, cashIn, cashOut }));
  }, [transactions]);

  const stats = useMemo(() => {
    const paid = profiles.filter((p) => p.plan_type !== "starter").length;
    const mrr = profiles.reduce((s, p) => s + (p.plan_type === "pro" ? 9 : p.plan_type === "team" ? 19.99 : 0), 0);
    const volume = transactions.reduce((s, t) => s + Number(t.amount), 0);
    return { paid, mrr, volume };
  }, [profiles, transactions]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat icon={<Users className="h-4 w-4" />} label="Total users" value={profiles.length.toLocaleString()} />
        <MiniStat icon={<TrendingUp className="h-4 w-4" />} label="Paid users" value={stats.paid.toLocaleString()} />
        <MiniStat icon={<DollarSign className="h-4 w-4" />} label="MRR est." value={`$${stats.mrr.toFixed(2)}`} />
        <MiniStat icon={<BookOpen className="h-4 w-4" />} label="Tx volume" value={`$${stats.volume.toFixed(0)}`} />
      </div>

      <SectionCard title="Signups — last 14 days" className="p-5">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={signupTrend}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              <Line type="monotone" dataKey="signups" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Plan distribution" className="p-5">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88} paddingAngle={3}>
                  {planDistribution.map((p) => <Cell key={p.name} fill={PLAN_COLORS[p.name] ?? "hsl(var(--muted))"} stroke="hsl(var(--card))" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Cash flow — last 14 days" className="p-5">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashTrend}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="cashIn" name="Cash In" fill="hsl(var(--cash-in))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cashOut" name="Cash Out" fill="hsl(var(--cash-out))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1.5 text-xl font-bold">{value}</p>
    </div>
  );
}
