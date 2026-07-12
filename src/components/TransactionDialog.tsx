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
import { addOfflineMutation, generateUUID } from "@/lib/offlineSync";
import { useFeatureGate } from "@/components/LockedFeature";
import { PlanBadge } from "@/components/PlanBadge";
import { useBusinessName } from "@/hooks/useBusinessName";
import { formatMoney } from "@/lib/format";
import { Lock, Printer } from "lucide-react";
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

  const businessName = useBusinessName();

  const handlePrintReceipt = () => {
    if (!editing) return;

    const cust = customerId !== "none" ? customers.find((c) => c.id === customerId) : null;
    const currentCashbook = cashbooks.find((c) => c.id === cashbookId);
    const cashbookName = currentCashbook?.name || "Primary Cashbook";
    const bizName = businessName || "My Business";

    const win = window.open("", "_blank");
    if (!win) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups to print the receipt.",
        variant: "destructive",
      });
      return;
    }

    const formattedAmount = formatMoney(Number(amount || editing.amount));
    const txTypeLabel = type === "in" ? "Cash In" : type === "out" ? "Cash Out" : type === "credit" ? "Credit" : "Debit";
    
    const dateObj = new Date(date || editing.date);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const activeMethod = methods.find((m) => m.id === paymentMethodId);
    const methodLabel = activeMethod ? activeMethod.label : paymentMethodId;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${bizName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 40px 20px;
            background-color: #f8fafc;
            color: #1e293b;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .receipt-container {
            max-width: 500px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
            overflow: hidden;
            position: relative;
          }

          .header-accent {
            height: 8px;
            background: ${type === "in" || type === "credit" ? "#16a34a" : "#dc2626"};
          }

          .receipt-body {
            padding: 40px;
          }

          .toolbar {
            max-width: 500px;
            margin: 0 auto 20px auto;
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 18px;
            font-size: 14px;
            font-weight: 500;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
            text-decoration: none;
          }

          .btn-primary {
            background-color: #2563eb;
            color: #ffffff;
          }

          .btn-primary:hover {
            background-color: #1d4ed8;
          }

          .btn-secondary {
            background-color: #ffffff;
            color: #475569;
            border: 1px solid #cbd5e1;
          }

          .btn-secondary:hover {
            background-color: #f8fafc;
          }

          .business-title {
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.025em;
            color: #0f172a;
            margin: 0 0 4px 0;
          }

          .subtitle {
            font-size: 13px;
            color: #64748b;
            margin: 0;
            font-weight: 500;
          }

          .receipt-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px dashed #e2e8f0;
            padding-bottom: 24px;
            margin-bottom: 28px;
          }

          .badge {
            display: inline-flex;
            align-items: center;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 700;
            border-radius: 9999px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .badge-income {
            background-color: #dcfce7;
            color: #15803d;
          }

          .badge-expense {
            background-color: #fee2e2;
            color: #b91c1c;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 28px;
          }

          .meta-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .meta-value {
            font-size: 14px;
            color: #1e293b;
            font-weight: 500;
          }

          .amount-section {
            background-color: #f8fafc;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            margin-bottom: 28px;
            border: 1px solid #f1f5f9;
          }

          .amount-label {
            font-size: 12px;
            font-weight: 600;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
          }

          .amount-value {
            font-size: 36px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.05em;
          }

          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 28px;
          }

          .details-row {
            border-bottom: 1px solid #f1f5f9;
          }

          .details-row:last-child {
            border-bottom: none;
          }

          .details-label {
            padding: 12px 0;
            font-size: 13px;
            color: #64748b;
            font-weight: 500;
            width: 35%;
          }

          .details-val {
            padding: 12px 0;
            font-size: 13px;
            color: #0f172a;
            font-weight: 600;
            text-align: right;
          }

          .footer {
            text-align: center;
            border-top: 1px dashed #e2e8f0;
            padding-top: 24px;
            margin-top: 28px;
          }

          .footer p {
            font-size: 12px;
            color: #94a3b8;
            margin: 0 0 4px 0;
          }

          .footer-brand {
            font-size: 11px;
            color: #cbd5e1;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          @media print {
            body {
              background-color: #ffffff;
              padding: 0;
            }
            .receipt-container {
              border: none;
              box-shadow: none;
              max-width: 100%;
            }
            .no-print {
              display: none !important;
            }
            .receipt-body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar no-print">
          <button onclick="window.close()" class="btn btn-secondary">Close</button>
          <button onclick="window.print()" class="btn btn-primary">Print Receipt</button>
        </div>

        <div class="receipt-container">
          <div class="header-accent"></div>
          <div class="receipt-body">
            <div class="receipt-header">
              <div>
                <h1 class="business-title">${bizName}</h1>
                <p class="subtitle">${cashbookName}</p>
              </div>
              <div>
                <span class="badge ${type === "in" || type === "credit" ? "badge-income" : "badge-expense"}">
                  ${txTypeLabel}
                </span>
              </div>
            </div>

            <div class="meta-grid">
              <div>
                <div class="meta-label">Receipt Number</div>
                <div class="meta-value">REC-${editing.id.slice(0, 8).toUpperCase()}</div>
              </div>
              <div>
                <div class="meta-label">Date Issued</div>
                <div class="meta-value">${formattedDate}</div>
              </div>
            </div>

            <div class="amount-section">
              <div class="amount-label">Amount Transacted</div>
              <div class="amount-value">${formattedAmount}</div>
            </div>

            <table class="details-table">
              <tr class="details-row">
                <td class="details-label">Category</td>
                <td class="details-val">${category || "—"}</td>
              </tr>
              <tr class="details-row">
                <td class="details-label">Payment Method</td>
                <td class="details-val">${methodLabel || "—"}</td>
              </tr>
              ${cust ? `
              <tr class="details-row">
                <td class="details-label">Customer</td>
                <td class="details-val">${cust.name}</td>
              </tr>
              ${cust.phone ? `
              <tr class="details-row">
                <td class="details-label">Phone</td>
                <td class="details-val">${cust.phone}</td>
              </tr>
              ` : ""}
              ` : ""}
              ${note ? `
              <tr class="details-row">
                <td class="details-label">Notes</td>
                <td class="details-val">${note}</td>
              </tr>
              ` : ""}
            </table>

            <div class="footer">
              <p>Thank you for your business!</p>
              <div class="footer-brand">Generated by ${bizName}</div>
            </div>
          </div>
        </div>

        <script>
          window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
              window.print();
            }, 300);
          });
        </script>
      </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
  };

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

    let error: any = null;
    let savedOffline = false;

    if (!navigator.onLine) {
      savedOffline = true;
      if (editing) {
        addOfflineMutation("transactions", "update", payload, editing.id);
      } else {
        const newId = generateUUID();
        const offlinePayload = {
          ...payload,
          id: newId,
          created_at: new Date().toISOString()
        };
        addOfflineMutation("transactions", "insert", offlinePayload);
      }
    } else {
      try {
        const dbRes = editing
          ? await supabase.from("transactions").update(payload).eq("id", editing.id)
          : await supabase.from("transactions").insert({
              ...payload,
              id: generateUUID(),
            });
        error = dbRes.error;
      } catch (err: any) {
        console.warn("Write to Supabase failed, falling back to offline cache:", err);
        savedOffline = true;
        if (editing) {
          addOfflineMutation("transactions", "update", payload, editing.id);
        } else {
          const newId = generateUUID();
          const offlinePayload = {
            ...payload,
            id: newId,
            created_at: new Date().toISOString()
          };
          addOfflineMutation("transactions", "insert", offlinePayload);
        }
      }
    }

    setBusy(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("fetch") || msg.includes("NetworkError") || error.status === 0) {
        savedOffline = true;
        if (editing) {
          addOfflineMutation("transactions", "update", payload, editing.id);
        } else {
          const newId = generateUUID();
          const offlinePayload = {
            ...payload,
            id: newId,
            created_at: new Date().toISOString()
          };
          addOfflineMutation("transactions", "insert", offlinePayload);
        }
      } else {
        return toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      }
    }

    if (savedOffline) {
      toast({
        title: editing ? "Entry updated locally" : "Entry added locally",
        description: "Your change is saved offline and will sync once internet is restored.",
      });
    } else {
      toast({ title: editing ? "Entry updated" : "Entry added" });
    }

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

          <div className="flex gap-2">
            {editing && (
              <Button
                type="button"
                variant="outline"
                onClick={handlePrintReceipt}
                className="h-11 flex-1 rounded-xl gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </Button>
            )}
            <Button type="submit" disabled={busy || !category} className={`h-11 rounded-xl ${editing ? "flex-1" : "w-full"}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Update Entry" : "Save Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
