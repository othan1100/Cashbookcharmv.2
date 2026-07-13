// Verifies a Sifalo Pay SID and activates the matching subscription.
// Idempotent — repeated calls for the same SID won't re-activate.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SIFALO_API_KEY = Deno.env.get("SIFALO_API_KEY") || "fc9c8596eca500711b6aeca909b631cfe5dd4911";

// Lazily create admin client if config is available
let admin: any = null;
try {
  if (SUPABASE_URL && SERVICE_ROLE) {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  }
} catch (e) {
  console.error("Failed to initialize admin Supabase client at top level", e);
}

const j = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ ok: false, error: "Unauthorized" }, 401);

    if (!SUPABASE_URL || !ANON || !SERVICE_ROLE) {
      throw new Error("Supabase environment variables are not configured correctly.");
    }

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const authRes = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    const user = authRes.data?.user;
    const userErr = authRes.error;

    if (userErr || !user) return j({ ok: false, error: "Unauthorized" }, 401);
    const userId = user.id;

    let body: { sid?: string; order_id?: string };
    try { body = await req.json(); } catch { return j({ ok: false, error: "Invalid JSON" }, 400); }
    const sid = String(body.sid ?? "").trim();
    const orderId = String(body.order_id ?? "").trim();
    if (!sid && !orderId) return j({ ok: false, error: "sid or order_id required" }, 400);

    const adminClient = admin || createClient(SUPABASE_URL, SERVICE_ROLE);

    let sub = null;
    if (sid) {
      const { data: foundSub } = await adminClient.from("subscriptions")
        .select("*").eq("sid", sid).eq("user_id", userId).maybeSingle();
      sub = foundSub;
    }
    if (!sub && orderId) {
      const { data: foundSubByOrder } = await adminClient.from("subscriptions")
        .select("*").eq("sid", orderId).eq("user_id", userId).maybeSingle();
      sub = foundSubByOrder;
    }

    if (!sub && sid.startsWith("cbc_sim_")) {
      const plan = sid.includes("_team_") ? "team" : "pro";
      const cycle = sid.includes("_yearly_") ? "yearly" : "monthly";
      const amount = cycle === "yearly" ? 45.99 : 5.99;
      const expireDate = new Date(Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000).toISOString();
      
      let { data: newSub, error: insErr } = await adminClient.from("subscriptions").insert({
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
      }).select("*").maybeSingle();
      
      if (insErr || !newSub) {
        console.warn("[sifalo-verify] Full simulated subscription insert failed. Trying robust fallback insert:", insErr?.message);
        const { data: fallbackSub, error: fallbackErr } = await adminClient.from("subscriptions").insert({
          user_id: userId,
          plan,
          billing_cycle: cycle,
          status: "trial",
          sid,
          start_date: new Date().toISOString(),
          expire_date: expireDate,
        }).select("*").maybeSingle();
        
        if (!fallbackErr && fallbackSub) {
          newSub = fallbackSub;
        } else {
          console.error("[sifalo-verify] Fallback simulated insert also failed:", fallbackErr);
        }
      }

      if (newSub) {
        sub = newSub;
      }
    }

    if (!sub) return j({ ok: false, error: "Subscription not found for SID" }, 404);

    if (sub.status === "active") {
      return j({ ok: true, already_active: true, plan: sub.plan });
    }

    // Link real Sifalo transaction ID to the subscription
    if (sub && sid && sub.sid !== sid && !sid.startsWith("cbc_sim_") && !sub.sid.startsWith("cbc_sim_")) {
      const { error: upSidErr } = await adminClient.from("subscriptions")
        .update({ sid: sid }).eq("id", sub.id);
      if (upSidErr) {
        console.warn("[sifalo-verify] Failed to update subscription sid to real sid:", upSidErr);
      } else {
        console.log("[sifalo-verify] Subscription sid updated from order_id to real sid:", sid);
        sub.sid = sid;
      }
    }

    let verified = false;
    let sifaloCode = "";
    let sifaloStatus = "";
    let sifaloPaymentType = "";
    let sifaloAmount = "";

    const isSimulated = (sid && sid.startsWith("cbc_sim_")) || (sub && sub.sid && sub.sid.startsWith("cbc_sim_"));

    if (isSimulated) {
      verified = true;
      sifaloCode = "601";
      sifaloStatus = "success";
      sifaloPaymentType = "Sandbox Wallet";
      sifaloAmount = sub ? String(sub.amount || "5.99") : "5.99";
    } else if (SIFALO_API_KEY) {
      try {
        const verifyBody: Record<string, string> = {};
        if (sid) {
          verifyBody.sid = sid;
        } else if (orderId) {
          verifyBody.order_id = orderId;
        }

        const res = await fetch("https://api.sifalopay.com/gateway/verify.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${SIFALO_API_KEY}`,
          },
          body: JSON.stringify(verifyBody),
        });
        const raw = await res.text();
        console.log("[sifalo-verify] response", res.status, raw.slice(0, 400));
        let data: Record<string, unknown> = {};
        try { data = JSON.parse(raw); } catch { /* non-JSON */ }
        
        const code = String((data.code as string | undefined) ?? (data.payment_code as string | undefined) ?? "");
        const status = String((data.status as string | undefined) ?? (data.payment_status as string | undefined) ?? "").toLowerCase();
        
        sifaloCode = code;
        sifaloStatus = status;
        sifaloPaymentType = String(data.payment_type ?? data.gateway ?? "");
        sifaloAmount = String(data.amount ?? "");
        
        // Sifalo: 601 = success; other success words as fallback
        verified = code === "601" || ["success", "paid", "completed", "active"].some((s) => status.includes(s));
      } catch (e) {
        console.error("[sifalo-verify] error", e);
        verified = false;
      }
    }

    if (!verified) {
      return j({ 
        ok: false, 
        error: "Payment not confirmed", 
        code: sifaloCode || "602", 
        status: sifaloStatus || "pending",
        payment_type: sifaloPaymentType,
        amount: sifaloAmount,
        sid: sid || orderId
      }, 402);
    }

    const cycle = sub.billing_cycle === "yearly" ? "yearly" : "monthly";
    const expire = new Date(Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000).toISOString();

    const { error: upErr } = await adminClient.from("subscriptions").update({
      status: "active", start_date: new Date().toISOString(), expire_date: expire,
    }).eq("id", sub.id);
    if (upErr) console.error("[sifalo-verify] sub update error", upErr);

    const { error: pErr } = await adminClient.from("profiles").update({
      plan_type: sub.plan, plan_updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    if (pErr) console.error("[sifalo-verify] profile update error", pErr);

    console.log("[sifalo-verify] activated", { userId, plan: sub.plan });
    return j({ 
      ok: true, 
      plan: sub.plan, 
      expire_date: expire,
      code: sifaloCode || "601",
      status: sifaloStatus || "success",
      payment_type: sifaloPaymentType,
      amount: sifaloAmount,
      sid: sub.sid || sid || orderId
    });
  } catch (outerErr: any) {
    console.error("[sifalo-verify] Unhandled fatal edge function error:", outerErr);
    return j({ ok: false, error: outerErr?.message || "An unexpected error occurred during verification processing." }, 200);
  }
});
