import { useState } from "react";
import { Loader2, Sparkles, Trash2, Upload, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveCashbook } from "@/hooks/useActiveCashbook";
import { useCashbooks, type DbCustomer } from "@/hooks/useData";
import { toast } from "@/hooks/use-toast";
import { useFeatureGate } from "@/components/LockedFeature";
import { PlanBadge } from "@/components/PlanBadge";

type Row = {
  date: string;         // yyyy-mm-dd or raw
  amount: number | null;
  type: "in" | "out";
};

const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, base64] = result.split(",");
      const mimeType = meta.match(/data:(.*?);/)?.[1] || file.type || "image/jpeg";
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const normalizeDate = (raw: string): string => {
  if (!raw) return new Date().toISOString();
  // Already ISO-like
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`).toISOString();
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: DbCustomer;
  onSaved?: () => void;
}

export function CustomerImportDialog({ open, onOpenChange, customer, onSaved }: Props) {
  const { user } = useAuth();
  const { activeId } = useActiveCashbook();
  const { data: cashbooks } = useCashbooks();
  const cashbookId = activeId || cashbooks[0]?.id;
  const gate = useFeatureGate("import_receipt");

  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const reset = () => { setRows([]); setPreviewUrl(null); };

  const handleFile = async (file: File) => {
    if (!gate.allowed) { gate.setOpen(true); return; }
    reset();
    setPreviewUrl(URL.createObjectURL(file));
    setScanning(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("scan-ledger", {
        body: { imageBase64: base64, mimeType },
      });
      if (error) throw error;
      const list = ((data as { transactions?: { date?: string; amount?: number | null; type?: string }[] })?.transactions ?? []).map((r) => ({
        date: r.date ?? "",
        amount: r.amount ?? null,
        type: (r.type === "out" ? "out" : "in") as "in" | "out",
      }));
      if (list.length === 0) toast({ title: "No transactions detected", description: "Try a clearer photo.", variant: "destructive" });
      setRows(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      toast({ title: "Scan failed", description: msg, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const validRows = rows.filter((r) => r.amount !== null && !isNaN(Number(r.amount)));
  const currentBalance = Number(customer.balance ?? 0);
  const netChange = validRows.reduce(
    (s, r) => s + (r.type === "in" ? Number(r.amount) : -Number(r.amount)),
    0,
  );
  const estimatedBalance = currentBalance + netChange;

  const handleSave = async () => {
    if (!user || !cashbookId) return toast({ title: "No cashbook", variant: "destructive" });
    if (validRows.length === 0) return toast({ title: "Nothing to save", description: "No rows with an amount.", variant: "destructive" });

    setSaving(true);
    // Sort chronologically before insert so history reads correctly
    const sorted = [...validRows].sort(
      (a, b) => new Date(normalizeDate(a.date)).getTime() - new Date(normalizeDate(b.date)).getTime(),
    );
    const payload = sorted.map((r) => ({
      user_id: user.id,
      cashbook_id: cashbookId,
      customer_id: customer.id,
      type: r.type,
      amount: Number(r.amount),
      category: "Imported",
      note: "[AI_IMPORT]",
      payment_method: "Cash" as const,
      date: normalizeDate(r.date),
    }));

    const { error } = await supabase.from("transactions").insert(payload);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Imported", description: `${payload.length} transactions added to ${customer.name}.` });
    reset();
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Import from Image · {customer.name}
          </DialogTitle>
        </DialogHeader>

        {!gate.allowed ? (
          <button
            type="button"
            onClick={() => gate.setOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-6 text-sm font-semibold text-primary/80 hover:bg-primary/10"
          >
            <Lock className="h-4 w-4" />
            Import from Image
            <PlanBadge variant="pro" />
          </button>
        ) : rows.length === 0 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-10 text-center text-sm font-semibold text-primary hover:bg-primary/10">
            {scanning ? (
              <><Loader2 className="h-6 w-6 animate-spin" />Reading document…</>
            ) : (
              <><Upload className="h-6 w-6" />Upload or capture a handwritten debt book, ledger, invoice, or statement
              <span className="text-xs font-normal text-muted-foreground">AI will read every row exactly as written</span></>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={scanning}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <div className="space-y-4">
            {previewUrl && (
              <div className="flex gap-3">
                <img src={previewUrl} alt="Source" className="h-24 w-24 rounded-lg object-cover border border-border" />
                <div className="flex-1 text-xs text-muted-foreground">
                  <p className="mb-1 font-semibold text-foreground">{rows.length} rows detected</p>
                  <p>Review each row below. Edit or delete any inaccurate entry. Then click Save to add them all to {customer.name}'s history.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-secondary/30 p-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Current balance</p>
                <p className="mt-1 font-mono text-sm font-bold">{currentBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Imported</p>
                <p className="mt-1 font-mono text-sm font-bold">{validRows.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated after</p>
                <p className={`mt-1 font-mono text-sm font-bold ${estimatedBalance >= 0 ? "text-[hsl(var(--cash-in))]" : "text-[hsl(var(--cash-out))]"}`}>
                  {estimatedBalance.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-1 py-1">
                        <Input value={r.date} onChange={(e) => updateRow(i, { date: e.target.value })} className="h-8 min-w-[110px] text-xs" />
                      </td>
                      <td className="px-1 py-1">
                        <select
                          value={r.type}
                          onChange={(e) => updateRow(i, { type: e.target.value as "in" | "out" })}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="in">In</option>
                          <option value="out">Out</option>
                        </select>
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={r.amount ?? ""}
                          onChange={(e) => updateRow(i, { amount: e.target.value === "" ? null : Number(e.target.value) })}
                          className="h-8 w-28 text-right text-xs font-mono"
                        />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <button type="button" onClick={() => removeRow(i)} className="text-destructive hover:opacity-70">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>


            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={reset} disabled={saving}>Start over</Button>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                <Upload className="h-3.5 w-3.5" />Re-scan
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
        )}

        {gate.dialog}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || rows.length === 0} className="rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Save ${rows.length || ""} transactions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
