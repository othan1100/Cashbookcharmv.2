// Verifies a Sifalo Pay SID and activates the matching subscription.
// Idempotent — repeated calls for the same SID won't re-activate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SIFALO_API_KEY = Deno.env.get("SIFALO_API_KEY") || "fc9c8596eca500711b6aeca909b631cfe5dd4911";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return j({ ok: false, error: "Unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !user) return j({ ok: false, error: "Unauthorized" }, 401);
  const userId = user.id;

  let body: { sid?: string };
  try { body = await req.json(); } catch { return j({ ok: false, error: "Invalid JSON" }, 400); }
  const sid = String(body.sid ?? "").trim();
  if (!sid) return j({ ok: false, error: "sid required" }, 400);

  let sub = null;
  const { data: foundSub } = await admin.from("subscriptions")
    .select("*").eq("sid", sid).eq("user_id", userId).maybeSingle();
  sub = foundSub;

  if (!sub && sid.startsWith("cbc_sim_")) {
    const plan = sid.includes("_team_") ? "team" : "pro";
    const cycle = sid.includes("_yearly_") ? "yearly" : "monthly";
    const amount = cycle === "yearly" ? 45.99 : 5.99;
    const expireDate = new Date(Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000).toISOString();
    
    const { data: newSub, error: insErr } = await admin.from("subscriptions").insert({
      user_id: userId,
      plan,
      billing_cycle: cycle,
      status: "pending",
      sid,
      customer_account: "+252610000000",
      payment_gateway: "sandbox",
      amount,
      start_date: new Date().toISOString(),
      expire_date: expireDate,
    }).select("*").single();
    
    if (!insErr) {
      sub = newSub;
    } else {
      console.error("[sifalo-verify] failed to insert simulated sub", insErr);
    }
  }

  if (!sub) return j({ ok: false, error: "Subscription not found for SID" }, 404);

  if (sub.status === "active") {
    return j({ ok: true, already_active: true, plan: sub.plan });
  }

  let verified = true;
  if (SIFALO_API_KEY) {
    try {
      const res = await fetch(`https://api.sifalopay.com/gateway/verify?sid=${encodeURIComponent(sid)}`, {
        headers: { "Authorization": `Basic ${SIFALO_API_KEY}` },
      });
      const raw = await res.text();
      console.log("[sifalo-verify] response", res.status, raw.slice(0, 400));
      let data: Record<string, unknown> = {};
      try { data = JSON.parse(raw); } catch { /* non-JSON */ }
      const code = String((data.code as string | undefined) ?? "");
      const status = String((data.status as string | undefined) ?? (data.payment_status as string | undefined) ?? "").toLowerCase();
      // Sifalo: 601 = success; other success words as fallback
      verified = code === "601" || ["success", "paid", "completed", "active"].some((s) => status.includes(s));
    } catch (e) {
      console.error("[sifalo-verify] error", e);
      verified = false;
    }
  }

  if (!verified) return j({ ok: false, error: "Payment not confirmed" }, 402);

  const cycle = sub.billing_cycle === "yearly" ? "yearly" : "monthly";
  const expire = new Date(Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000).toISOString();

  const { error: upErr } = await admin.from("subscriptions").update({
    status: "active", start_date: new Date().toISOString(), expire_date: expire,
  }).eq("id", sub.id);
  if (upErr) console.error("[sifalo-verify] sub update error", upErr);

  const { error: pErr } = await admin.from("profiles").update({
    plan_type: sub.plan, plan_updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  if (pErr) console.error("[sifalo-verify] profile update error", pErr);

  console.log("[sifalo-verify] activated", { userId, plan: sub.plan });
  return j({ ok: true, plan: sub.plan, expire_date: expire });
});
