import { useEffect, useState } from "react";
import { Loader2, Shield, Trash2, Users, BookOpen, Receipt, UserSquare2, MessageSquare, Star, UserPlus, KeyRound, Pencil } from "lucide-react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/format";
import { AdminPricingEditor, AdminAppSettings } from "@/components/admin/AdminPricingEditor";
import { AdminPlanSwitcher } from "@/components/admin/AdminPlanSwitcher";
import { AdminInsights } from "@/components/admin/AdminInsights";

type AdminUser = {
  user_id: string; email: string | null; display_name: string | null; business_name: string | null;
  country: string | null; city: string | null; plan_type: string; trial_ends_at: string | null;
  created_at: string; balance: number; cash_in: number; cash_out: number; tx_count: number;
};
type Cashbook = { id: string; user_id: string; name: string; description: string | null; created_at: string };
type Customer = { id: string; user_id: string; name: string; phone: string | null; balance: number };
type Tx = { id: string; user_id: string; type: string; amount: number; category: string; date: string };
type Feedback = { id: string; user_id: string; category: string; rating: number | null; message: string; status: string; created_at: string };

export default function Admin() {
  const { isAdmin, isViewer, canAccessAdmin, loading: roleLoading } = useIsAdmin();
  const readOnly = isViewer && !isAdmin;
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [cashbooks, setCashbooks] = useState<Cashbook[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  useEffect(() => { document.title = "Admin — CashBook"; }, []);

  const refresh = async () => {
    setLoading(true);
    const [u, c, cu, t, f] = await Promise.all([
      supabase.functions.invoke("admin-list-users"),
      supabase.from("cashbooks").select("id,user_id,name,description,created_at").order("created_at", { ascending: false }),
      supabase.from("customers").select("id,user_id,name,phone,balance").order("created_at", { ascending: false }),
      supabase.from("transactions").select("id,user_id,type,amount,category,date").order("date", { ascending: false }).limit(500),
      supabase.from("feedback").select("id,user_id,category,rating,message,status,created_at").order("created_at", { ascending: false }),
    ]);
    setUsers(((u.data as { users?: AdminUser[] })?.users) ?? []);
    setCashbooks((c.data as Cashbook[]) || []);
    setCustomers((cu.data as Customer[]) || []);
    setTransactions((t.data as Tx[]) || []);
    setFeedback((f.data as Feedback[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (canAccessAdmin) refresh(); }, [canAccessAdmin]);

  if (roleLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!canAccessAdmin) return <Navigate to="/" replace />;

  const handleDelete = async (table: "cashbooks" | "customers" | "transactions" | "profiles" | "feedback", id: string, idCol: "id" | "user_id" = "id") => {
    if (readOnly) return toast({ title: "Read-only access", description: "Viewers cannot modify data.", variant: "destructive" });
    if (!confirm("Delete this record permanently?")) return;
    let error: { message: string } | null = null;
    if (table === "cashbooks") ({ error } = await supabase.from("cashbooks").delete().eq(idCol, id));
    else if (table === "customers") ({ error } = await supabase.from("customers").delete().eq(idCol, id));
    else if (table === "transactions") ({ error } = await supabase.from("transactions").delete().eq(idCol, id));
    else if (table === "feedback") ({ error } = await supabase.from("feedback").delete().eq(idCol, id));
    else ({ error } = await supabase.from("profiles").delete().eq(idCol, id));
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    toast({ title: "Deleted" });
    refresh();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {readOnly ? "Read-only viewer access — you can browse but not modify data" : "Full control over all users and data"}
          </p>
        </div>
        {readOnly && (
          <span className="ml-auto rounded-full border border-border/60 bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            View only
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={<Users className="h-4 w-4" />} label="Users" value={users.length} />
        <Stat icon={<BookOpen className="h-4 w-4" />} label="Cashbooks" value={cashbooks.length} />
        <Stat icon={<UserSquare2 className="h-4 w-4" />} label="Customers" value={customers.length} />
        <Stat icon={<Receipt className="h-4 w-4" />} label="Transactions" value={transactions.length} />
        <Stat icon={<MessageSquare className="h-4 w-4" />} label="Feedback" value={feedback.length} />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="insights" className="space-y-4">
          <TabsList className="flex w-full flex-wrap gap-1 rounded-xl bg-secondary p-1 h-auto">
            <TabsTrigger value="insights" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card">Insights</TabsTrigger>
            <TabsTrigger value="users" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card">Users</TabsTrigger>
            <TabsTrigger value="cashbooks" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card">Cashbooks</TabsTrigger>
            <TabsTrigger value="customers" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card">Customers</TabsTrigger>
            <TabsTrigger value="transactions" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-card">Transactions</TabsTrigger>
            <TabsTrigger value="feedback" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card">Feedback</TabsTrigger>
            <TabsTrigger value="pricing" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card">Pricing</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="space-y-4">
            <AdminPlanSwitcher />
            <AdminInsights />
          </TabsContent>

          <TabsContent value="users">
            <SectionCard>
              <div className="mb-4 flex justify-end">
                <AddUserDialog onCreated={refresh} disabled={readOnly} />
              </div>
              <Table head={["Name / Email", "Business", "Plan", "Balance", "Tx", "Joined", ""]}>
                {users.map((p) => (
                  <tr key={p.user_id} className="border-t border-border/60">
                    <Td>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.display_name || "—"}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.email ?? "—"}</p>
                      </div>
                    </Td>
                    <Td>{p.business_name || "—"}</Td>
                    <Td>
                      <Select
                        value={p.plan_type || "starter"}
                        onValueChange={async (v) => {
                          if (readOnly) return;
                          const { error } = await supabase.from("profiles").update({ plan_type: v, plan_updated_at: new Date().toISOString() }).eq("user_id", p.user_id);
                          if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
                          toast({ title: "Plan updated", description: `→ ${v}` });
                          refresh();
                        }}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                        </SelectContent>
                      </Select>
                    </Td>
                    <Td>
                      <span className={p.balance >= 0 ? "font-mono text-xs text-[hsl(var(--cash-in))]" : "font-mono text-xs text-[hsl(var(--cash-out))]"}>
                        {formatMoney(p.balance)}
                      </span>
                    </Td>
                    <Td>{p.tx_count}</Td>
                    <Td>{new Date(p.created_at).toLocaleDateString()}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => setEditingUser(p)} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                        <DeleteBtn disabled={readOnly} onClick={() => handleDelete("profiles", p.user_id, "user_id")} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="cashbooks">
            <SectionCard>
              <Table head={["Name", "Description", "Created", ""]}>
                {cashbooks.map((c) => (
                  <tr key={c.id} className="border-t border-border/60">
                    <Td>{c.name}</Td>
                    <Td>{c.description || "—"}</Td>
                    <Td>{new Date(c.created_at).toLocaleDateString()}</Td>
                    <Td><DeleteBtn disabled={readOnly} onClick={() => handleDelete("cashbooks", c.id)} /></Td>
                  </tr>
                ))}
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="customers">
            <SectionCard>
              <Table head={["Name", "Phone", "Balance", ""]}>
                {customers.map((c) => (
                  <tr key={c.id} className="border-t border-border/60">
                    <Td>{c.name}</Td>
                    <Td>{c.phone || "—"}</Td>
                    <Td>{Number(c.balance).toFixed(2)}</Td>
                    <Td><DeleteBtn disabled={readOnly} onClick={() => handleDelete("customers", c.id)} /></Td>
                  </tr>
                ))}
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="transactions">
            <SectionCard>
              <Table head={["Date", "Type", "Category", "Amount", ""]}>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-border/60">
                    <Td>{new Date(t.date).toLocaleDateString()}</Td>
                    <Td><span className="rounded-md bg-secondary px-2 py-0.5 text-xs uppercase">{t.type}</span></Td>
                    <Td>{t.category}</Td>
                    <Td>{Number(t.amount).toFixed(2)}</Td>
                    <Td><DeleteBtn disabled={readOnly} onClick={() => handleDelete("transactions", t.id)} /></Td>
                  </tr>
                ))}
              </Table>
            </SectionCard>
          </TabsContent>

          <TabsContent value="feedback">
            <SectionCard>
              {feedback.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No feedback yet.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {feedback.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">{f.category}</span>
                          {f.rating ? (
                            <span className="inline-flex items-center gap-0.5 text-xs text-primary">
                              {Array.from({ length: f.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                            </span>
                          ) : null}
                          <span className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{f.message}</p>
                      </div>
                      <DeleteBtn disabled={readOnly} onClick={() => handleDelete("feedback", f.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="pricing">
            <AdminPricingEditor readOnly={readOnly} />
          </TabsContent>

          <TabsContent value="settings">
            <AdminAppSettings readOnly={readOnly} />
          </TabsContent>
        </Tabs>
      )}
      <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} onSaved={refresh} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1.5 text-2xl font-bold">{value}</p>
    </div>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[520px] text-sm">
        <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          {head.map((h, i) => <th key={i} className="px-3 py-2 font-semibold">{h}</th>)}
        </tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children }: { children: React.ReactNode }) { return <td className="px-3 py-2.5 align-middle">{children}</td>; }
function DeleteBtn({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  if (disabled) return <span className="text-xs text-muted-foreground">—</span>;
  return <Button variant="ghost" size="sm" onClick={onClick} className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>;
}

function AddUserDialog({ onCreated, disabled }: { onCreated: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "team">("starter");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email, password, display_name: displayName, business_name: businessName, plan_type: plan },
    });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      return toast({ title: "Failed", description: (data as { error?: string })?.error ?? error?.message, variant: "destructive" });
    }
    toast({ title: "User created", description: email });
    setOpen(false); setEmail(""); setPassword(""); setDisplayName(""); setBusinessName(""); setPlan("starter");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button disabled={disabled} onClick={() => setOpen(true)} className="gap-2 rounded-xl"><UserPlus className="h-4 w-4" />Add user</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Create new user</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password (min 6)</Label><Input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><Label>Business name</Label><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as "starter" | "pro" | "team")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create user"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onSaved }: { user: AdminUser | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "team">("starter");

  useEffect(() => {
    if (user) {
      setEmail(user.email ?? "");
      setPassword("");
      setDisplayName(user.display_name ?? "");
      setBusinessName(user.business_name ?? "");
      setPlan((user.plan_type as "starter" | "pro" | "team") ?? "starter");
    }
  }, [user]);

  if (!user) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {
      user_id: user.user_id,
      display_name: displayName,
      business_name: businessName,
      plan_type: plan,
    };
    if (email && email !== user.email) payload.email = email;
    if (password) payload.password = password;
    const { data, error } = await supabase.functions.invoke("admin-update-user", { body: payload });
    setBusy(false);
    if (error || (data as { error?: string })?.error) {
      return toast({ title: "Failed", description: (data as { error?: string })?.error ?? error?.message, variant: "destructive" });
    }
    toast({ title: "User updated", description: email });
    onClose();
    onSaved();
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Edit user</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div>
            <Label>New password (leave blank to keep)</Label>
            <Input type="text" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 chars" />
          </div>
          <div><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><Label>Business name</Label><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
          <div>
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as "starter" | "pro" | "team")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-xl">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
