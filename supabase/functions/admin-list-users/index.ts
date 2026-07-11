// Admin: list users with email + plan + balance. Caller must be admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const callerId = claims?.claims?.sub;
  if (!callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Fetch auth users (paginated)
  const allUsers: { id: string; email: string | undefined; created_at: string }[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    allUsers.push(...data.users.map(u => ({ id: u.id, email: u.email, created_at: u.created_at })));
    if (data.users.length < 200) break;
    page++;
    if (page > 25) break;
  }

  const [{ data: profiles }, { data: txs }] = await Promise.all([
    admin.from("profiles").select("user_id, display_name, business_name, country, city, plan_type, trial_ends_at, trial_plan, created_at"),
    admin.from("transactions").select("user_id, type, amount"),
  ]);

  const balanceMap = new Map<string, { in: number; out: number; count: number }>();
  for (const t of (txs ?? []) as Array<{ user_id: string; type: string; amount: number }>) {
    const row = balanceMap.get(t.user_id) ?? { in: 0, out: 0, count: 0 };
    if (t.type === "in") row.in += Number(t.amount); else row.out += Number(t.amount);
    row.count++;
    balanceMap.set(t.user_id, row);
  }

  const profMap = new Map((profiles ?? []).map(p => [p.user_id, p]));
  const result = allUsers.map(u => {
    const p = profMap.get(u.id);
    const b = balanceMap.get(u.id) ?? { in: 0, out: 0, count: 0 };
    return {
      user_id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      display_name: p?.display_name ?? null,
      business_name: p?.business_name ?? null,
      country: p?.country ?? null,
      city: p?.city ?? null,
      plan_type: p?.plan_type ?? "starter",
      trial_ends_at: p?.trial_ends_at ?? null,
      trial_plan: p?.trial_plan ?? null,
      balance: b.in - b.out,
      cash_in: b.in,
      cash_out: b.out,
      tx_count: b.count,
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return new Response(JSON.stringify({ users: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
