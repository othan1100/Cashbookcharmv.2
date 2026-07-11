import { useEffect, useState } from "react";
import { Loader2, Paperclip, Plus, ScanLine, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCustomers, useCashbooks, type DbTransaction } from "@/hooks/useData";
import { useActiveCashbook } from "@/hooks/useActiveCashbook";
import { toast } from "@/hooks/use-toast";
import { useFeatureGate } from "@/components/LockedFeature";
import { PlanBadge } from "@/components/PlanBadge";
import { Lock } from "lucide-react";
import {
  BUILTIN_METHODS,
  DbPaymentMethod,
  PaymentMethod,
  getPaymentMethods,
  savePaymentMethods,
} from "@/lib/payment-methods";

const DEFAULT_CATEGORIES = [
  "Sales", "Services", "Rent", "Utilities", "Salary",
  "Supplies", "Transport", "Food", "Marketing",
  "Construction", "Materials", "Equipment", "Labor",
  "Maintenance", "Other",
];

type TxType = "in" | "out" | "credit" | "debit";

const TYPE_BUTTONS: { value: TxType; label: string; activeClass: string }[] = [
  { value: "in", label: "Cash In", activeClass: "bg-[hsl(var(--cash-in))] text-white" },
  { value: "out", label: "Cash Out", activeClass: "bg-[hsl(var(--cash-out))] text-white" },
  { value: "credit", label: "Credit", activeClass: "bg-primary text-primary-foreground" },
  { value: "debit", label: "Debit", activeClass: "bg-amber-500 text-white" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  editing?: DbTransaction | null;
}

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

export function TransactionDialog({ open, onOpenChange, onCreated, editing }: Props) {
  const { user } = useAuth();
  const { data: customers, refresh: refreshCustomers } = useCustomers();
  const { data: cashbooks } = useCashbooks();
  const { activeId } = useActiveCashbook();
  const cashbookId = activeId || cashbooks[0]?.id;
  const importGate = useFeatureGate("import_receipt");

  const [type, setType] = useState<TxType>("in");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [customerId, setCustomerId] = useState("none");
  const [paymentMethodId, setPaymentMethodId] = useState("cash");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [savingCust, setSavingCust] = useState(false);

  const [methods, setMethods] = useState<PaymentMethod[]>(() => getPaymentMethods());
  const [showManageMethods, setShowManageMethods] = useState(false);
  const [newMethodLabel, setNewMethodLabel] = useState("");
  const [newMethodDb, setNewMethodDb] = useState<DbPaymentMethod>("Bank");

  const customCats: { name: string; type: "income" | "expense" }[] = (() => {
    try { return JSON.parse(localStorage.getItem("cashbook.customCategories") || "[]"); } catch { return []; }
  })();
  const allCategories = [...DEFAULT_CATEGORIES, ...customCats.map((c) => c.name)];

  useEffect(() => {
    if (!open) {
      setType("in"); setAmount(""); setCategory(""); setCustomerId("none");
      setPaymentMethodId("cash"); setNote(""); setFile(null);
      setDate(new Date().toISOString().slice(0, 10));
      setShowNewCustomer(false); setNewCustName(""); setNewCustPhone("");
      setShowManageMethods(false); setNewMethodLabel("");
    } else {
      setMethods(getPaymentMethods());
      if (editing) {
        setType((editing.type as TxType) ?? "in");
        setAmount(String(editing.amount));
        setCategory(editing.category || "");
        setCustomerId(editing.customer_id ?? "none");
        setNote(editing.note ?? "");
        setDate(new Date(editing.date).toISOString().slice(0, 10));
        const m = getPaymentMethods().find((mm) => mm.dbValue === editing.payment_method);
        if (m) setPaymentMethodId(m.id);
      }
    }
  }, [open, editing]);

  const persistMethods = (next: PaymentMethod[]) => { setMethods(next); savePaymentMethods(next); };

  const handleAddMethod = () => {
    const label = newMethodLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/\s+/g, "-") + "-" + Math.random().toString(36).slice(2, 6);
    persistMethods([...methods, { id, label, dbValue: newMethodDb }]);
    setNewMethodLabel("");
    toast({ title: "Payment method added", description: `${label} (saved as ${newMethodDb})` });
  };

  const handleDeleteMethod = (id: string) => {
    if (BUILTIN_METHODS.map((m) => m.toLowerCase()).includes(id)) {
      toast({ title: "Cannot delete built-in method", variant: "destructive" });
      return;
    }
    persistMethods(methods.filter((m) => m.id !== id));
    if (paymentMethodId === id) setPaymentMethodId("cash");
  };

  const handleCreateCustomer = async () => {
    if (!user || !cashbookId || !newCustName.trim()) return;
    setSavingCust(true);
    const { data, error } = await supabase.from("customers").insert({
      user_id: user.id, cashbook_id: cashbookId,
      name: newCustName.trim(), phone: newCustPhone.trim() || null, balance: 0,
    }).select().single();
    setSavingCust(false);
    if (error || !data) {
      toast({ title: "Could not add customer", description: error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Customer added", description: data.name });
    await refreshCustomers();
    setCustomerId(data.id);
    setShowNewCustomer(false); setNewCustName(""); setNewCustPhone("");
  };

  const handleScanReceipt = async (selected: File) => {
    setScanning(true);
    try {
      const { base64, mimeType } = await fileToBase64(selected);
      const { data, error } = await supabase.functions.invoke("scan-receipt", {
        body: { imageBase64: base64, mimeType },
      });
      if (error) throw error;
      const ex = (data as { extracted?: Record<string, unknown> })?.extracted || {};
      if (ex.amount) setAmount(String(ex.amount));
      if (ex.date && typeof ex.date === "string") setDate(ex.date.slice(0, 10));
      if (ex.category && typeof ex.category === "string") setCategory(String(ex.category));
      if (ex.note && typeof ex.note === "string") setNote(String(ex.note));
      if (ex.type === "in" || ex.type === "out") setType(ex.type);

      // Auto-create or match customer
      const cName = (ex.customer_name as string | undefined)?.trim();
      if (cName && user && cashbookId) {
        const existing = customers.find((c) => c.name.toLowerCase() === cName.toLowerCase());
        if (existing) {
          setCustomerId(existing.id);
        } else {
          const { data: nc } = await supabase.from("customers").insert({
            user_id: user.id, cashbook_id: cashbookId,
            name: cName, phone: (ex.customer_phone as string | undefined) || null, balance: 0,
          }).select().single();
          if (nc) {
            await refreshCustomers();
            setCustomerId(nc.id);
          }
        }
      }
      toast({ title: "Receipt scanned", description: "Fields auto-filled. Review and save." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      toast({ title: "Scan failed", description: msg, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !cashbookId) {
      toast({ title: "No cashbook", description: "Please create a cashbook first.", variant: "destructive" });
      return;
    }
    setBusy(true);

    let attachment_url: string | null = editing?.attachment_url ?? null;
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, file);
      if (upErr) {
        setBusy(false);
        toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
        return;
      }
      // Bucket is private; store the storage path and resolve to a signed URL on read.
      attachment_url = path;
    }

    const selectedMethod = methods.find((m) => m.id === paymentMethodId) || methods[0];
    const payload = {
      user_id: user.id,
      cashbook_id: cashbookId,
      type,
      amount: Number(amount),
      category,
      note: note ? `${selectedMethod.label !== selectedMethod.dbValue ? `[${selectedMethod.label}] ` : ""}${note}` : (selectedMethod.label !== selectedMethod.dbValue ? `[${selectedMethod.label}]` : null),
      payment_method: selectedMethod.dbValue,
      customer_id: customerId === "none" ? null : customerId,
      date: new Date(date).toISOString(),
      attachment_url,
    };

    const { error } = editing
      ? await supabase.from("transactions").update(payload).eq("id", editing.id)
      : await supabase.from("transactions").insert(payload);

    setBusy(false);
    if (error) return toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Entry updated" : "Entry added" });
    onOpenChange(false);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">{editing ? "Edit Transaction" : "New Transaction"}</DialogTitle>
        </DialogHeader>

        {/* AI Import button — gated on Pro */}
        {!editing && (
          importGate.allowed ? (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 py-3 text-sm font-semibold text-primary hover:bg-primary/10">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {scanning ? "Scanning receipt…" : "Import from receipt / invoice photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); handleScanReceipt(f); }
                  e.target.value = "";
                }}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => importGate.setOpen(true)}
              className="relative flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-semibold text-primary/80 hover:bg-primary/10"
            >
              <Lock className="h-4 w-4" />
              Import from receipt
              <PlanBadge variant="pro" />
            </button>
          )
        )}
        {importGate.dialog}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {TYPE_BUTTONS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setType(b.value)}
                className={`rounded-full py-2 text-xs font-semibold transition-all ${type === b.value ? b.activeClass : "bg-secondary text-muted-foreground"}`}
              >
                {b.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Amount ($)</Label>
            <Input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="font-mono text-lg" />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Customer (optional)</Label>
              <button type="button" onClick={() => setShowNewCustomer((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plus className="h-3 w-3" /> {showNewCustomer ? "Cancel" : "Add new"}
              </button>
            </div>
            {!showNewCustomer ? (
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2 rounded-xl border border-dashed border-border/80 bg-secondary/30 p-3">
                <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Customer name" />
                <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="Phone (optional)" />
                <Button type="button" size="sm" disabled={savingCust || !newCustName.trim()} onClick={handleCreateCustomer} className="w-full rounded-lg">
                  {savingCust ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Customer"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Payment Method</Label>
              <button type="button" onClick={() => setShowManageMethods((v) => !v)}
                className="text-xs font-semibold text-primary hover:underline">
                {showManageMethods ? "Done" : "Manage"}
              </button>
            </div>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}{m.label !== m.dbValue && <span className="text-muted-foreground"> · {m.dbValue}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showManageMethods && (
              <div className="space-y-2 rounded-xl border border-dashed border-border/80 bg-secondary/30 p-3">
                <ul className="space-y-1.5">
                  {methods.map((m) => {
                    const builtin = BUILTIN_METHODS.includes(m.id as DbPaymentMethod);
                    return (
                      <li key={m.id} className="flex items-center justify-between rounded-lg bg-card px-2.5 py-1.5 text-xs">
                        <span className="font-medium">
                          {m.label}{m.label !== m.dbValue && <span className="text-muted-foreground"> · {m.dbValue}</span>}
                          {builtin && <span className="ml-1.5 text-[9px] uppercase text-muted-foreground">built-in</span>}
                        </span>
                        {!builtin && (
                          <button type="button" onClick={() => handleDeleteMethod(m.id)} className="text-destructive hover:opacity-80" aria-label="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="flex gap-2 pt-1">
                  <Input value={newMethodLabel} onChange={(e) => setNewMethodLabel(e.target.value)} placeholder="e.g. Salam Bank" className="flex-1 h-9" />
                  <Select value={newMethodDb} onValueChange={(v) => setNewMethodDb(v as DbPaymentMethod)}>
                    <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUILTIN_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" onClick={handleAddMethod} className="h-9 rounded-lg">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Attachment / Invoice (optional)</Label>
            {file ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2.5">
                <span className="truncate text-sm">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} className="rounded-md p-1 hover:bg-secondary">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 py-3 text-sm text-muted-foreground hover:bg-secondary/50">
                <Paperclip className="h-4 w-4" />
                Attach Receipt / Invoice
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          <Button type="submit" disabled={busy || !category} className="h-11 w-full rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update Entry" : "Save Entry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
