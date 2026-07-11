import { useState } from "react";
import { ArrowLeftRight, BookOpen, Plus, Loader2, Lock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCashbooks, type DbCashbook } from "@/hooks/useData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { useFeatureGate } from "@/components/LockedFeature";
import { PlanBadge } from "@/components/PlanBadge";
import { toast } from "@/hooks/use-toast";

export default function Cashbooks() {
  const { user } = useAuth();
  const { data: cashbooks, loading, refresh } = useCashbooks();
  const { plan, limits } = usePlan();
  const multiGate = useFeatureGate("multi_cashbook");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState<DbCashbook | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const atLimit = cashbooks.length >= limits.cashbooks;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (atLimit) {
      toast({ title: "Upgrade required", description: `Your ${plan} plan allows ${limits.cashbooks} cashbook${limits.cashbooks === 1 ? "" : "s"}. Upgrade to Pro for unlimited.`, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("cashbooks").insert({ user_id: user.id, name, description: description || null });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Cashbook created" });
    setOpen(false); setName(""); setDescription("");
    refresh();
  };

  const openEdit = (cb: DbCashbook) => {
    setEditing(cb);
    setEditName(cb.name);
    setEditDesc(cb.description ?? "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.from("cashbooks").update({ name: editName, description: editDesc || null }).eq("id", editing.id);
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Cashbook updated" });
    setEditing(null);
    refresh();
  };

  const handleDelete = async (cb: DbCashbook) => {
    if (cashbooks.length <= 1) return toast({ title: "Cannot delete", description: "You must keep at least one cashbook.", variant: "destructive" });
    if (!confirm(`Delete "${cb.name}"? All transactions inside will also be deleted.`)) return;
    const { error } = await supabase.from("cashbooks").delete().eq("id", cb.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Cashbook deleted" });
    refresh();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Cashbook Charm</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Cashbooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage multiple ledger books</p>
        </div>
        {atLimit && !multiGate.allowed ? (
          <Button size="lg" className="gap-2 rounded-xl" onClick={() => multiGate.setOpen(true)}>
            <Lock className="h-4 w-4" />New Cashbook<PlanBadge variant="pro" />
          </Button>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 rounded-xl bg-info text-info-foreground hover:bg-info/90">
                <Plus className="h-4 w-4" />New Cashbook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Cashbook</DialogTitle>
                <p className="text-sm text-muted-foreground">Create a separate ledger to organize transactions.</p>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Office, Site A" /></div>
                <div className="space-y-2"><Label>Description (optional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this cashbook for?" /></div>
                <Button type="submit" className="w-full rounded-xl" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
        {multiGate.dialog}
      </header>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : cashbooks.length === 0 ? (
        <SectionCard>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No cashbooks yet. Create your first cashbook to organize transactions.</p>
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {cashbooks.map((cb) => (
            <div key={cb.id} className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-foreground group-hover:bg-primary/15 group-hover:text-primary">
                  <ArrowLeftRight className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{cb.name}</p>
                  {cb.description && <p className="truncate text-xs text-muted-foreground">{cb.description}</p>}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Actions">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => openEdit(cb)}><Pencil className="mr-2 h-4 w-4" />Rename / Edit</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDelete(cb)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Cashbook</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input required value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
            <Button type="submit" className="w-full rounded-xl" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
