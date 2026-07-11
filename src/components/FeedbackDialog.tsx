import { useState } from "react";
import { Loader2, Send, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CATEGORIES = [
  { value: "general", label: "General feedback" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "improvement", label: "Improvement" },
  { value: "other", label: "Other" },
];

export function FeedbackDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [category, setCategory] = useState("general");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setCategory("general"); setRating(0); setMessage(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!message.trim()) return toast({ title: "Please write your feedback", variant: "destructive" });
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      category,
      rating: rating || null,
      message: message.trim(),
    });
    if (error) {
      setSubmitting(false);
      return toast({ title: "Could not send", description: error.message, variant: "destructive" });
    }

    // Best-effort email notification — don't block UX if it fails
    try {
      const cat = CATEGORIES.find((c) => c.value === category)?.label ?? category;
      const stars = rating ? "⭐".repeat(rating) : "—";
      await supabase.functions.invoke("send-email", {
        body: {
          to: "cashbookcharm@resend.dev",
          subject: `New feedback (${cat})`,
          html: `
            <h2>New feedback received</h2>
            <p><strong>From:</strong> ${user.email ?? user.id}</p>
            <p><strong>Category:</strong> ${cat}</p>
            <p><strong>Rating:</strong> ${stars}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space:pre-wrap;border-left:3px solid #2563eb;padding-left:12px;">${message.trim().replace(/[<>]/g, "")}</p>
          `,
        },
      });
    } catch (err) {
      console.warn("Feedback email notification failed", err);
    }

    setSubmitting(false);
    toast({ title: "Thanks for your feedback! 🙌" });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>Tell us what you love, what's broken, or what you'd like to see.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rating (optional)</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(rating === n ? 0 : n)}
                  className="rounded-md p-1 transition-transform hover:scale-110"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star className={cn("h-6 w-6", n <= rating ? "fill-primary text-primary" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Your message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Share your thoughts..."
              rows={5}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{message.length}/2000</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
