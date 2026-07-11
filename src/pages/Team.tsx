import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, UserPlus, Users, Crown, Trash2, ScrollText, Mail, Shield, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { SectionCard } from "@/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const MAX_MEMBERS = 10;
type Role = "owner" | "admin" | "editor" | "viewer";

type Team = { id: string; name: string; owner_id: string; member_limit: number };
type Member = { id: string; user_id: string; role: Role; created_at: string };
type Invite = { id: string; email: string; role: Role; status: string; expires_at: string; created_at: string; token: string };
type AuditRow = { id: string; user_id: string; action: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown>; created_at: string };

export default function Team() {
  const { user } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("My Team");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");

  useEffect(() => { document.title = "Team — CashBook"; }, []);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    // Find a team where user is owner OR member
    const { data: ownedTeams } = await supabase.from("teams").select("*").eq("owner_id", user.id).limit(1);
    let t: Team | null = (ownedTeams?.[0] as Team) || null;
    if (!t) {
      const { data: memberships } = await supabase.from("team_members").select("team_id").eq("user_id", user.id).limit(1);
      if (memberships?.[0]) {
        const { data: tm } = await supabase.from("teams").select("*").eq("id", memberships[0].team_id).maybeSingle();
        t = (tm as Team) || null;
      }
    }
    setTeam(t);
    if (t) {
      const [{ data: m }, { data: i }, { data: l }] = await Promise.all([
        supabase.from("team_members").select("*").eq("team_id", t.id).order("created_at"),
        supabase.from("team_invites").select("*").eq("team_id", t.id).order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("*").eq("team_id", t.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setMembers((m as Member[]) || []);
      setInvites((i as Invite[]) || []);
      setLogs((l as AuditRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [user]);

  if (planLoading || loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (plan !== "team") {
    return (
      <SectionCard className="p-8 text-center max-w-xl mx-auto">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Users className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold">Team plan required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite up to {MAX_MEMBERS} members with roles (admin / editor / viewer), share cashbooks across your business, and get a full audit trail of every change.
        </p>
        <ul className="mt-4 mx-auto max-w-sm space-y-2 text-left text-sm">
          {["Up to 10 team members & roles", "Shared cashbooks across the team", "Audit logs of every change", "Priority WhatsApp support"].map((b) => (
            <li key={b} className="flex items-start gap-2"><span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">✓</span>{b}</li>
          ))}
        </ul>
        <Button asChild className="mt-6 rounded-xl gap-2">
          <Link to="/pricing?highlight=team&from=team_management"><Crown className="h-4 w-4" />Upgrade to Team</Link>
        </Button>
      </SectionCard>
    );
  }

  const isOwner = team?.owner_id === user?.id;
  const totalSeats = (members.length || 0) + (team ? 1 : 0); // owner + members
  const seatsLeft = Math.max(0, MAX_MEMBERS - totalSeats);

  const createTeam = async () => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("teams").insert({ owner_id: user.id, name: newName, member_limit: MAX_MEMBERS }).select().maybeSingle();
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await supabase.from("audit_logs").insert({ user_id: user.id, team_id: (data as Team).id, action: "team.created", metadata: { name: newName } });
    toast({ title: "Team created" });
    refresh();
  };

  const sendInvite = async () => {
    if (!user || !team) return;
    if (seatsLeft <= 0) return toast({ title: "Member limit reached", description: `Teams are capped at ${MAX_MEMBERS} seats.`, variant: "destructive" });
    if (!inviteEmail.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("team_invites").insert({
      team_id: team.id, email: inviteEmail.trim().toLowerCase(), role: inviteRole, invited_by: user.id,
    }).select().maybeSingle();
    if (error || !data) {
      setBusy(false);
      return toast({ title: "Invite failed", description: error?.message, variant: "destructive" });
    }
    const inv = data as Invite;
    const link = `${window.location.origin}/team?invite=${inv.token}`;
    await supabase.functions.invoke("send-email", {
      body: {
        to: inv.email,
        subject: `You've been invited to join ${team.name} on Cashbook Charm`,
        html: `<p>Hi,</p><p>You've been invited to join <strong>${team.name}</strong> as <strong>${inv.role}</strong>.</p><p><a href="${link}">Accept invitation</a></p><p>This link expires in 14 days.</p>`,
      },
    });
    await supabase.from("audit_logs").insert({ user_id: user.id, team_id: team.id, action: "invite.sent", entity_type: "invite", entity_id: inv.id, metadata: { email: inv.email, role: inv.role } });
    setBusy(false);
    setInviteEmail("");
    toast({ title: "Invite sent", description: `Email sent to ${inv.email}` });
    refresh();
  };

  const revokeInvite = async (id: string) => {
    if (!user) return;
    await supabase.from("team_invites").update({ status: "revoked" }).eq("id", id);
    await supabase.from("audit_logs").insert({ user_id: user.id, team_id: team!.id, action: "invite.revoked", entity_type: "invite", entity_id: id });
    refresh();
  };

  const removeMember = async (m: Member) => {
    if (!user || !team) return;
    if (!confirm("Remove this member?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", m.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    await supabase.from("audit_logs").insert({ user_id: user.id, team_id: team.id, action: "member.removed", entity_type: "member", entity_id: m.user_id });
    toast({ title: "Member removed" });
    refresh();
  };

  // Accept invite via ?invite=token
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get("invite");
  const acceptInvite = async () => {
    if (!user || !inviteToken) return;
    const { data: inv } = await supabase.from("team_invites").select("*").eq("token", inviteToken).maybeSingle();
    if (!inv) return toast({ title: "Invalid invite", variant: "destructive" });
    const i = inv as Invite & { team_id: string };
    const { error } = await supabase.from("team_members").insert({ team_id: i.team_id, user_id: user.id, role: i.role });
    if (error) return toast({ title: "Couldn't join", description: error.message, variant: "destructive" });
    await supabase.from("team_invites").update({ status: "accepted" }).eq("id", i.id);
    await supabase.from("audit_logs").insert({ user_id: user.id, team_id: i.team_id, action: "member.joined", entity_type: "member", entity_id: user.id });
    toast({ title: "You joined the team" });
    window.history.replaceState({}, "", "/team");
    refresh();
  };

  if (!team) {
    if (inviteToken) {
      return (
        <SectionCard className="p-8 text-center max-w-md mx-auto">
          <Users className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-xl font-bold">Accept team invitation</h2>
          <p className="mt-1 text-sm text-muted-foreground">You've been invited to join a team.</p>
          <Button onClick={acceptInvite} className="mt-5 rounded-xl">Accept invite</Button>
        </SectionCard>
      );
    }
    return (
      <SectionCard className="p-8 max-w-xl mx-auto">
        <div className="flex items-center gap-3"><Users className="h-6 w-6 text-primary" /><h2 className="text-xl font-bold">Create your team</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Invite up to {MAX_MEMBERS} members and share cashbooks.</p>
        <div className="mt-5 space-y-3">
          <Label>Team name</Label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Team" />
          <Button onClick={createTeam} disabled={busy} className="w-full rounded-xl gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} Create team
          </Button>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Team</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{team.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{totalSeats} of {MAX_MEMBERS} seats used · {seatsLeft} remaining</p>
        </div>
        {isOwner && <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary inline-flex items-center gap-1.5"><Crown className="h-3 w-3" />Owner</span>}
      </header>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-secondary p-1">
          <TabsTrigger value="members" className="rounded-lg data-[state=active]:bg-card">Members</TabsTrigger>
          <TabsTrigger value="invites" className="rounded-lg data-[state=active]:bg-card">Invites</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-card">Audit logs</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <SectionCard className="p-5 space-y-4">
            {isOwner && (
              <div className="rounded-2xl border border-border/60 bg-secondary/40 p-4">
                <div className="mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold">Invite member</h3></div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" type="email" className="flex-1 min-w-[200px]" />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={sendInvite} disabled={busy || seatsLeft <= 0} className="rounded-xl gap-1">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send
                  </Button>
                </div>
                {seatsLeft <= 0 && <p className="mt-2 text-xs text-destructive">Member limit reached ({MAX_MEMBERS}).</p>}
              </div>
            )}

            <ul className="divide-y divide-border/60">
              <li className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary"><Crown className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold">{team.owner_id === user?.id ? "You" : team.owner_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">Owner</p>
                  </div>
                </div>
              </li>
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Shield className="h-4 w-4" /></div>
                    <div>
                      <p className="text-sm font-semibold">{m.user_id === user?.id ? "You" : m.user_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                    </div>
                  </div>
                  {isOwner && m.user_id !== user?.id && (
                    <Button variant="ghost" size="sm" onClick={() => removeMember(m)} className="text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </TabsContent>

        <TabsContent value="invites">
          <SectionCard className="p-5">
            {invites.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No invites yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{i.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{i.role} · {i.status} · expires {new Date(i.expires_at).toLocaleDateString()}</p>
                    </div>
                    {isOwner && i.status === "pending" && (
                      <Button variant="ghost" size="sm" onClick={() => revokeInvite(i.id)} className="text-destructive hover:bg-destructive/10">Revoke</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="audit">
          <SectionCard className="p-5">
            <div className="mb-3 flex items-center gap-2"><ScrollText className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold">Recent activity</h3></div>
            {logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs">{l.action}</span>
                      {l.entity_type && <span className="text-xs text-muted-foreground truncate">· {l.entity_type}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
