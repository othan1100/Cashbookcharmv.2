import { useState } from "react";
import { Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Gateway = "waafi" | "edahab" | "pbwallet";

type Props = {
  open: boolean;
  onClose: () => void;
  plan: string;
  planName: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
  onActivated?: () => void;
};

const GATEWAYS: { id: Gateway; label: string; hint: string }[] = [
  { id: "waafi", label: "WAAFI", hint: "EVC Plus / Hormuud" },
  { id: "edahab", label: "eDahab", hint: "Somtel eDahab wallet" },
  { id: "pbwallet", label: "Premier Wallet", hint: "Premier Bank wallet" },
];

type Phase = "form" | "processing" | "success" | "pending" | "error";

export function PaymentModal({ open, onClose, plan, planName, billingCycle, amount, onActivated }: Props) {
  const [gateway, setGateway] = useState<Gateway>("waafi");
  const [account, setAccount] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [message, setMessage] = useState("");
  const [sid, setSid] = useState<string | null>(null);

  const reset = () => { setPhase("form"); setMessage(""); setSid(null); };
  const handleClose = () => { if (phase === "processing") return; reset(); onClose(); };

  const submit = async () => {
    const cleaned = account.replace(/[^0-9+]/g, "");
    if (cleaned.length < 7) { setMessage("Enter a valid mobile number."); setPhase("error"); return; }

    setPhase("processing");
    setMessage("Sending payment request to your wallet…");

    try {
      const { data, error } = await supabase.functions.invoke("sifalo-checkout", {
        body: { plan, billing_cycle: billingCycle, account: cleaned, gateway },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Payment request failed");

      setSid(data.sid);

      if (data.status === "completed") {
        // Verify to activate subscription server-side
        const { data: v } = await supabase.functions.invoke("sifalo-verify", { body: { sid: data.sid } });
        if (v?.ok) {
          setPhase("success");
          setMessage("Payment completed. Subscription activated.");
          onActivated?.();
          return;
        }
        setPhase("pending");
        setMessage("Payment pending confirmation.");
        return;
      }

      setPhase("pending");
      setMessage("Payment pending confirmation. Approve the request on your phone.");
    } catch (e) {
      setPhase("error");
      setMessage((e as Error).message || "Payment failed");
    }
  };

  const verifyAgain = async () => {
    if (!sid) return;
    setPhase("processing");
    setMessage("Checking payment status…");
    const { data } = await supabase.functions.invoke("sifalo-verify", { body: { sid } });
    if (data?.ok) {
      setPhase("success");
      setMessage("Payment completed. Subscription activated.");
      onActivated?.();
    } else {
      setPhase("pending");
      setMessage(data?.error || "Payment pending confirmation.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to {planName}</DialogTitle>
          <DialogDescription>
            {billingCycle === "yearly" ? "Yearly billing" : "Monthly billing"} · ${amount.toFixed(2)} USD
          </DialogDescription>
        </DialogHeader>

        {phase === "form" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Choose mobile wallet</Label>
              <RadioGroup value={gateway} onValueChange={(v) => setGateway(v as Gateway)} className="grid gap-2">
                {GATEWAYS.map((g) => (
                  <label key={g.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-colors",
                      gateway === g.id && "border-primary bg-primary/5 ring-1 ring-primary/40",
                    )}>
                    <RadioGroupItem value={g.id} id={`gw-${g.id}`} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{g.label}</div>
                      <div className="text-xs text-muted-foreground">{g.hint}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-account">Wallet mobile number</Label>
              <Input id="wallet-account" inputMode="tel" placeholder="e.g. 252612345678"
                value={account} onChange={(e) => setAccount(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                You will receive a payment request on this number. Approve it to activate your plan.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={handleClose}>Cancel</Button>
              <Button className="flex-1 rounded-xl" onClick={submit}>Pay ${amount.toFixed(2)}</Button>
            </div>
          </div>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-[hsl(var(--cash-in))]" />
            <p className="text-base font-semibold">Payment completed</p>
            <p className="text-sm text-muted-foreground">Subscription activated.</p>
            <Button className="mt-2 rounded-xl" onClick={handleClose}>Done</Button>
          </div>
        )}

        {phase === "pending" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Clock className="h-10 w-10 text-amber-500" />
            <p className="text-base font-semibold">Payment pending confirmation</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="rounded-xl" onClick={handleClose}>Close</Button>
              <Button className="rounded-xl" onClick={verifyAgain}>I've paid — check now</Button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <p className="text-base font-semibold">Payment failed</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" className="rounded-xl" onClick={handleClose}>Close</Button>
              <Button className="rounded-xl" onClick={reset}>Try again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
