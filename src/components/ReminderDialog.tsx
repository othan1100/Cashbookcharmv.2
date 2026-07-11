import { useEffect, useMemo, useState } from "react";
import { Mail, MessageCircle, Phone, CheckCircle2, Bell, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";

const TEMPLATE_KEY = "cashbook.reminderTemplate";
const AUTO_KEY = "cashbook.autoReminderDays";

const DEFAULT_TEMPLATE =
  "Hello [Customer Name], this is a friendly reminder that you have an outstanding balance of [Amount Due] for [Service/Product]. Kindly make the payment by [Due Date] via [Payment Method]. If you have already paid, please ignore this message. Thank you for your continued support.";

export type ReminderCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: ReminderCustomer | null;
  amountDue: number;
  onMarkedPaid?: () => void;
}

export function ReminderDialog({ open, onOpenChange, customer, amountDue, onMarkedPaid }: Props) {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [service, setService] = useState("outstanding balance");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoDays, setAutoDays] = useState("7");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(TEMPLATE_KEY);
    if (t) setTemplate(t);
    const a = localStorage.getItem(AUTO_KEY);
    if (a) {
      try {
        const parsed = JSON.parse(a);
        setAutoEnabled(!!parsed.enabled);
        setAutoDays(String(parsed.days ?? 7));
      } catch {}
    }
  }, [open]);

  const finalMessage = useMemo(() => {
    if (!customer) return "";
    return template
      .split("[Customer Name]").join(customer.name)
      .split("[Amount Due]").join(formatMoney(Math.abs(amountDue)))
      .split("[Service/Product]").join(service || "outstanding balance")
      .split("[Due Date]").join(new Date(dueDate).toLocaleDateString())
      .split("[Payment Method]").join(paymentMethod);
  }, [template, customer, amountDue, service, dueDate, paymentMethod]);

  const saveTemplate = () => {
    localStorage.setItem(TEMPLATE_KEY, template);
    localStorage.setItem(AUTO_KEY, JSON.stringify({ enabled: autoEnabled, days: Number(autoDays) || 7 }));
    toast({ title: "Saved", description: "Reminder template & settings saved." });
  };

  const sendWhatsApp = () => {
    if (!customer?.phone) return toast({ title: "No phone", description: "Customer has no phone number.", variant: "destructive" });
    const url = `https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(finalMessage)}`;
    window.open(url, "_blank");
  };

  const sendSMS = () => {
    if (!customer?.phone) return toast({ title: "No phone", description: "Customer has no phone number.", variant: "destructive" });
    window.open(`sms:${customer.phone}?body=${encodeURIComponent(finalMessage)}`);
  };

  const sendEmail = () => {
    if (!customer?.email) return toast({ title: "No email", description: "Customer has no email address.", variant: "destructive" });
    const subject = `Payment reminder — ${formatMoney(Math.abs(amountDue))}`;
    window.open(`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(finalMessage)}`);
  };

  const markPaid = async () => {
    if (!customer || amountDue >= 0) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { data: cb } = await supabase.from("cashbooks").select("id").limit(1).maybeSingle();
    if (!u.user || !cb) { setBusy(false); return; }
    const { error } = await supabase.from("transactions").insert({
      user_id: u.user.id,
      cashbook_id: cb.id,
      customer_id: customer.id,
      type: "in",
      amount: Math.abs(amountDue),
      category: "Payment",
      note: "Marked as paid from reminder",
      payment_method: paymentMethod as "Cash" | "Card" | "Bank" | "Mobile",
      date: new Date().toISOString(),
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Marked as paid", description: `${customer.name}'s balance settled.` });
    onMarkedPaid?.();
    onOpenChange(false);
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Send Reminder — {customer.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Outstanding: <span className="font-semibold text-destructive">{formatMoney(Math.abs(amountDue))}</span>
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Service / Product</Label>
              <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Invoice #123" />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Bank">Bank Transfer</SelectItem>
                <SelectItem value="Mobile">Mobile Money</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message Template</Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={5}
              placeholder="Use [Customer Name], [Amount Due], [Service/Product], [Due Date], [Payment Method]"
            />
            <p className="text-[11px] text-muted-foreground">
              Variables: [Customer Name] · [Amount Due] · [Service/Product] · [Due Date] · [Payment Method]
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
            <p className="whitespace-pre-wrap text-sm">{finalMessage}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-3">
            <div>
              <Label className="cursor-pointer">Auto reminders</Label>
              <p className="text-xs text-muted-foreground">Repeat reminder every selected days</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={autoDays} onValueChange={setAutoDays} disabled={!autoEnabled}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[3, 7, 14, 30].map((d) => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
                </SelectContent>
              </Select>
              <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button onClick={sendWhatsApp} className="gap-1.5 bg-[hsl(142_71%_45%)] text-white hover:bg-[hsl(142_71%_40%)]">
              <MessageCircle className="h-4 w-4" />WhatsApp
            </Button>
            <Button onClick={sendSMS} variant="secondary" className="gap-1.5">
              <Phone className="h-4 w-4" />SMS
            </Button>
            <Button onClick={sendEmail} variant="secondary" className="gap-1.5">
              <Mail className="h-4 w-4" />Email
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button onClick={saveTemplate} variant="outline" className="rounded-xl">Save Template</Button>
            <Button onClick={markPaid} disabled={busy || amountDue >= 0} className="gap-1.5 rounded-xl bg-[hsl(var(--cash-in))] text-white hover:bg-[hsl(var(--cash-in)/0.9)]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark as Paid
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
