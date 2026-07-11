// Sifalo Pay — direct mobile wallet checkout.
// Accepts { plan, billing_cycle, account, gateway } and creates a pending
// subscription, then invokes the Sifalo gateway API to trigger a wallet push.
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
const SIFALO_ACCOUNT = Deno.env.get("SIFALO_MERCHANT_ACCOUNT") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
const ALLOWED_GATEWAYS = ["waafi", "edahab", "pbwallet"] as const;

const j = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ success: false, error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return j({ success: false, error: "Unauthorized" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !user) {
    return j({ success: false, error: "Unauthorized" }, 401);
  }
  const userId = user.id;

  let body: {
    plan?: string;
    billing_cycle?: "monthly" | "yearly";
    account?: string;
    gateway?: string;
  };
  try {
    body = await req.json();
  } catch {
    return j({ success: false, error: "Invalid JSON" }, 400);
  }

  const plan = String(body.plan ?? "").toLowerCase();
  const cycle = body.billing_cycle === "yearly" ? "yearly" : "monthly";
  const account = String(body.account ?? "").replace(/[^0-9+]/g, "");
  const gateway = String(body.gateway ?? "").toLowerCase();

  if (!["pro", "team"].includes(plan)) return j({ success: false, error: "Invalid plan" }, 400);
  if (!account || account.length < 7) return j({ success: false, error: "Invalid mobile number" }, 400);
  if (!(ALLOWED_GATEWAYS as readonly string[]).includes(gateway)) {
    return j({ success: false, error: "Invalid gateway" }, 400);
  }
  if (!SIFALO_API_KEY) {
    return j({ success: false, error: "Sifalo API key not configured" }, 500);
  }

  // Load plan pricing
  const { data: planRow, error: planErr } = await admin
    .from("pricing_plans").select("*").eq("id", plan).maybeSingle();
  if (planErr || !planRow) return j({ success: false, error: "Plan not found" }, 404);

  const amount = cycle === "yearly" ? Number(planRow.yearly_price) : Number(planRow.monthly_price);
  const orderId = `cbc_${userId.slice(0, 8)}_${plan}_${cycle}_${Date.now()}`;
  const expireDate = new Date(
    Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000,
  ).toISOString();

  // Prevent duplicate active subscription creation for the same plan+cycle in flight
  const { data: existingActive } = await admin
    .from("subscriptions")
    .select("id, plan")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (existingActive && existingActive.plan === plan) {
    return j({ success: false, error: "You already have an active subscription for this plan." }, 409);
  }

  const { data: inserted, error: insErr } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan,
    billing_cycle: cycle,
    status: "pending",
    sid: orderId,
    customer_account: account,
    payment_gateway: gateway,
    amount,
    start_date: new Date().toISOString(),
    expire_date: expireDate,
  }).select("id").single();
  if (insErr) {
    console.error("[sifalo-checkout] insert error", insErr);
    return j({ success: false, error: "Failed to create subscription" }, 500);
  }

  const payload = {
    account,
    gateway,
    amount: String(amount),
    currency: "USD",
    order_id: orderId,
    ...(SIFALO_ACCOUNT ? { merchant_account: SIFALO_ACCOUNT } : {}),
  };
  console.log("[sifalo-checkout] request", { orderId, plan, cycle, gateway, account });

  let sifaloData: Record<string, unknown> = {};
  let sifaloStatus = 0;
  let sifaloRaw = "";
  try {
    const res = await fetch("https://api.sifalopay.com/gateway/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${SIFALO_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    sifaloStatus = res.status;
    sifaloRaw = await res.text();
    try { sifaloData = JSON.parse(sifaloRaw); } catch { /* non-JSON */ }
    console.log("[sifalo-checkout] response", sifaloStatus, sifaloRaw.slice(0, 500));
  } catch (e) {
    console.error("[sifalo-checkout] network error", e);
    await admin.from("subscriptions").update({ status: "failed" }).eq("id", inserted.id);
    return j({ success: false, error: "Payment gateway unreachable" }, 502);
  }

  const code = String(
    (sifaloData.code as string | undefined) ??
    (sifaloData.status as string | undefined) ?? "",
  );
  const sid = String(
    (sifaloData.sid as string | undefined) ??
    ((sifaloData.data as Record<string, unknown> | undefined)?.sid as string | undefined) ??
    "",
  );
  const message = String(
    (sifaloData.response as string | undefined) ??
    (sifaloData.message as string | undefined) ??
    "Payment request failed",
  );

  // 601 = success, 603 = pending confirmation. Both treated as accepted.
  const accepted = code === "601" || code === "603";
  if (!accepted || !sid) {
    await admin.from("subscriptions").update({ status: "failed" }).eq("id", inserted.id);
    return j({
      success: false,
      error: message || "Payment request rejected",
      code,
    }, 400);
  }

  await admin.from("subscriptions").update({ sid }).eq("id", inserted.id);
  console.log("[sifalo-checkout] accepted", { sid, code });

  return j({
    success: true,
    sid,
    code,
    status: code === "601" ? "completed" : "pending",
    message: code === "601"
      ? "Payment completed. Subscription activated."
      : "Payment pending confirmation.",
  });
});
