import { useEffect, useState } from "react";
import { Loader2, Save, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

type Plan = {
  id: string;
  name: string;
  tagline: string | null;
  monthly_price: number;
  yearly_price: number;
  yearly_discount_pct: number;
  features: string[];
  highlighted: boolean;
  active: boolean;
  sort_order: number;
};

const DEFAULT_PLANS: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    tagline: "For growing businesses",
    monthly_price: 5.99,
    yearly_price: 45.99,
    yearly_discount_pct: 36,
    features: ["Unlimited cashbooks", "Unlimited transactions", "Customer statements & PDF", "Receipt scanning (AI)", "Advanced reports", "Priority email support"],
    highlighted: true,
    sort_order: 1,
    active: true,
  },
  {
    id: "team",
    name: "Team",
    tagline: "For teams & multi-user businesses",
    monthly_price: 8.99,
    yearly_price: 69.99,
    yearly_discount_pct: 35,
    features: ["Everything in Pro", "Team members & roles", "Shared cashbooks", "Audit log", "Dedicated onboarding", "Priority WhatsApp support"],
    highlighted: false,
    sort_order: 2,
    active: true,
  }
];

export function AdminPricingEditor({ readOnly }: { readOnly?: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("pricing_plans") as any)
      .select("*").order("sort_order");
    if (error) toast({ title: "Failed to load plans", description: error.message, variant: "destructive" });
    setPlans(((data as unknown as Plan[]) || []).map((p) => ({
      ...p,
      features: Array.isArray(p.features) ? p.features : [],
    })));
    setLoading(false);
  };

  const resetToDefaults = async () => {
    if (readOnly) return;
    setSavingId("reset");
    try {
      for (const p of DEFAULT_PLANS) {
        const { error } = await (supabase.from("pricing_plans") as any).upsert({
          id: p.id,
          name: p.name,
          tagline: p.tagline,
          monthly_price: p.monthly_price,
          yearly_price: p.yearly_price,
          yearly_discount_pct: p.yearly_discount_pct,
          features: p.features,
          highlighted: p.highlighted,
          sort_order: p.sort_order,
          active: p.active,
        });
        if (error) throw error;
      }
      toast({ title: "Successfully reset database pricing plans to new default prices!" });
      load();
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const createNewPlan = async () => {
    if (readOnly) return;
    setSavingId("create");
    const nextSortOrder = plans.length + 1;
    const newId = `plan_${Date.now()}`;
    const newPlanData = {
      id: newId,
      name: "New Custom Plan",
      tagline: "Plan Description/Tagline",
      monthly_price: 12.99,
      yearly_price: 99.99,
      yearly_discount_pct: 35,
      features: ["Feature 1", "Feature 2"],
      highlighted: false,
      active: true,
      sort_order: nextSortOrder,
    };

    try {
      const { error } = await (supabase.from("pricing_plans") as any).insert(newPlanData);
      if (error) throw error;
      toast({ title: "Created new custom plan!" });
      load();
    } catch (err: any) {
      toast({ title: "Creation failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const deletePlan = async (id: string) => {
    if (readOnly) return;
    if (!confirm(`Are you sure you want to delete the plan "${id}"?`)) return;
    setSavingId(`delete-${id}`);
    try {
      const { error } = await (supabase.from("pricing_plans") as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Plan deleted successfully!" });
      load();
    } catch (err: any) {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<Plan>) =>
    setPlans((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const moveUp = async (index: number) => {
    if (index === 0 || readOnly) return;
    const newPlans = [...plans];
    const temp = newPlans[index];
    newPlans[index] = newPlans[index - 1];
    newPlans[index - 1] = temp;
    
    const updated = newPlans.map((p, idx) => ({ ...p, sort_order: idx + 1 }));
    setPlans(updated);
    
    setSavingId("reorder");
    try {
      for (const p of updated) {
        await (supabase.from("pricing_plans") as any).update({ sort_order: p.sort_order }).eq("id", p.id);
      }
      toast({ title: "Plans reordered successfully" });
    } catch (err: any) {
      toast({ title: "Reordering failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const moveDown = async (index: number) => {
    if (index === plans.length - 1 || readOnly) return;
    const newPlans = [...plans];
    const temp = newPlans[index];
    newPlans[index] = newPlans[index + 1];
    newPlans[index + 1] = temp;
    
    const updated = newPlans.map((p, idx) => ({ ...p, sort_order: idx + 1 }));
    setPlans(updated);
    
    setSavingId("reorder");
    try {
      for (const p of updated) {
        await (supabase.from("pricing_plans") as any).update({ sort_order: p.sort_order }).eq("id", p.id);
      }
      toast({ title: "Plans reordered successfully" });
    } catch (err: any) {
      toast({ title: "Reordering failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const save = async (p: Plan) => {
    if (readOnly) return;

    // Validation checks
    if (!p.name || p.name.trim().length < 2) {
      return toast({ title: "Validation Error", description: "Plan name must be at least 2 characters.", variant: "destructive" });
    }
    if (!p.tagline || p.tagline.trim().length < 3) {
      return toast({ title: "Validation Error", description: "Tagline must be at least 3 characters.", variant: "destructive" });
    }
    if (p.monthly_price < 0) {
      return toast({ title: "Validation Error", description: "Monthly price cannot be negative.", variant: "destructive" });
    }
    if (p.yearly_discount_pct < 0 || p.yearly_discount_pct > 100) {
      return toast({ title: "Validation Error", description: "Annual discount must be between 0% and 100%.", variant: "destructive" });
    }
    if (p.yearly_price < 0) {
      return toast({ title: "Validation Error", description: "Yearly price cannot be negative.", variant: "destructive" });
    }
    if (!p.features || p.features.length === 0) {
      return toast({ title: "Validation Error", description: "Plan must list at least 1 feature.", variant: "destructive" });
    }

    setSavingId(p.id);
    const { error } = await (supabase.from("pricing_plans") as any).update({
      name: p.name,
      tagline: p.tagline,
      monthly_price: Number(p.monthly_price),
      yearly_price: Number(p.yearly_price),
      yearly_discount_pct: Number(p.yearly_discount_pct),
      features: p.features,
      highlighted: p.highlighted,
      active: p.active,
    }).eq("id", p.id);
    setSavingId(null);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: `${p.name} plan saved` });
  };

  const applyDiscount = (p: Plan) => {
    const yearly = Number(p.monthly_price) * 12 * (1 - Number(p.yearly_discount_pct) / 100);
    update(p.id, { yearly_price: Math.round(yearly * 100) / 100 });
  };

  if (loading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-secondary/30 p-4 rounded-2xl border border-border/40">
        <div>
          <h4 className="text-sm font-bold">Pricing Configuration & Management</h4>
          <p className="text-xs text-muted-foreground mt-0.5">Edit existing options, configure discounts, add custom tiers, or restore the latest 5.99/8.99/45.99/69.99 default prices.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={resetToDefaults} disabled={readOnly || savingId !== null} className="text-xs font-semibold rounded-xl">
            Reset to New Defaults
          </Button>
          <Button size="sm" onClick={createNewPlan} disabled={readOnly || savingId !== null} className="text-xs font-semibold rounded-xl">
            + Create Custom Plan
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-secondary/20 rounded-2xl border border-dashed border-border/60 max-w-lg mx-auto space-y-4 py-12">
          <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          <h3 className="text-base font-bold">No pricing plans found in database</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
            Your database's <strong>pricing_plans</strong> table is currently empty. Click the button below to initialize and seed it with the standard Pro ($5.99) and Team ($8.99) default plans.
          </p>
          <Button onClick={resetToDefaults} disabled={readOnly || savingId !== null} className="w-full sm:w-auto rounded-xl font-bold">
            {savingId === "reset" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Initialize Database with Default Plans
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p, idx) => (
            <SectionCard key={p.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold">{p.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-secondary" disabled={readOnly || idx === 0} onClick={() => moveUp(idx)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-secondary" disabled={readOnly || idx === plans.length - 1} onClick={() => moveDown(idx)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{p.id}</span>
              </div>

              <div className="space-y-2">
                <Label>Plan name</Label>
                <Input value={p.name} disabled={readOnly} onChange={(e) => update(p.id, { name: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input value={p.tagline || ""} disabled={readOnly} onChange={(e) => update(p.id, { tagline: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Monthly price (USD)</Label>
                  <Input type="number" step="0.01" min="0" disabled={readOnly}
                    value={p.monthly_price ?? 0}
                    onChange={(e) => update(p.id, { monthly_price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Annual discount (%)</Label>
                  <Input type="number" step="1" min="0" max="100" disabled={readOnly}
                    value={p.yearly_discount_pct ?? 20}
                    onChange={(e) => update(p.id, { yearly_discount_pct: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Yearly price (USD)</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" min="0" disabled={readOnly}
                    value={p.yearly_price ?? 0}
                    onChange={(e) => update(p.id, { yearly_price: Number(e.target.value) })} />
                  <Button type="button" variant="outline" size="sm" disabled={readOnly} onClick={() => applyDiscount(p)} className="shrink-0">
                    Auto from %
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Features (one per line)</Label>
                <Textarea rows={5} disabled={readOnly}
                  value={(p.features || []).join("\n")}
                  onChange={(e) => update(p.id, { features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={!!p.highlighted} disabled={readOnly}
                    onCheckedChange={(v) => update(p.id, { highlighted: v })} />
                  <Label className="text-sm">Highlight as popular</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={p.active !== false} disabled={readOnly}
                    onCheckedChange={(v) => update(p.id, { active: v })} />
                  <Label className="text-sm">Active</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => save(p)} disabled={readOnly || savingId === p.id} className="flex-1 gap-2 rounded-xl font-semibold">
                  {savingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Plan Settings
                </Button>
                {!["pro", "team"].includes(p.id) && (
                  <Button variant="destructive" onClick={() => deletePlan(p.id)} disabled={readOnly || savingId !== null} className="px-4 rounded-xl font-semibold">
                    Delete
                  </Button>
                )}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminAppSettings({ readOnly }: { readOnly?: boolean }) {
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_settings").select("*").eq("id", 1).maybeSingle();
      if (data) {
        setEmail((data as { support_email?: string | null }).support_email || "");
        setWhatsapp((data as { support_whatsapp?: string | null }).support_whatsapp || "");
        setMessage((data as { support_message?: string | null }).support_message || "");
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (readOnly) return;
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      id: 1, support_email: email || null, support_whatsapp: whatsapp || null, support_message: message || null,
    });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Settings saved" });
  };

  if (loading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <SectionCard className="p-5 space-y-4 max-w-2xl">
      <div>
        <h3 className="text-base font-bold">Support contact</h3>
        <p className="text-sm text-muted-foreground">Shown to all users on the Settings → Support section.</p>
      </div>
      <div className="space-y-2">
        <Label>Support email</Label>
        <Input type="email" value={email} disabled={readOnly} onChange={(e) => setEmail(e.target.value)} placeholder="info.support@cashbookcharm.com" />
      </div>
      <div className="space-y-2">
        <Label>Support WhatsApp (E.164 format)</Label>
        <Input value={whatsapp} disabled={readOnly} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+252619172003" />
        <p className="text-xs text-muted-foreground">Pro & Team customers will see a "Chat on WhatsApp" button using this number.</p>
      </div>
      <div className="space-y-2">
        <Label>Support message</Label>
        <Input value={message} disabled={readOnly} onChange={(e) => setMessage(e.target.value)} placeholder="We're here to help..." />
      </div>
      <Button onClick={save} disabled={readOnly || saving} className="gap-2 rounded-xl">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
      </Button>
    </SectionCard>
  );
}
