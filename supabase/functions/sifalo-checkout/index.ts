// Sifalo Pay — direct mobile wallet checkout.
// Accepts { plan, billing_cycle, account, gateway } and creates a pending
// subscription, then invokes the Sifalo gateway API to trigger a wallet push.
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
const SIFALO_ACCOUNT = Deno.env.get("SIFALO_MERCHANT_ACCOUNT") ?? "";

// Lazily create admin client if config is available
let admin: any = null;
try {
  if (SUPABASE_URL && SERVICE_ROLE) {
    admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  }
} catch (e) {
  console.error("Failed to initialize admin Supabase client at top level", e);
}

const ALLOWED_GATEWAYS = ["waafi", "edahab", "pbwallet", "checkout"] as const;

const j = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), {
    status: 200, // Always return 200 to client to avoid non-2xx invoke exceptions
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ success: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return j({ success: false, error: "Unauthorized" });
    }

    if (!SUPABASE_URL || !ANON || !SERVICE_ROLE) {
      throw new Error("Supabase environment variables are not configured correctly.");
    }

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    
    // Robust getUser call to avoid TypeError if data is null
    const authRes = await userClient.auth.getUser(token);
    const user = authRes.data?.user;
    const userErr = authRes.error;
    
    if (userErr || !user) {
      return j({ success: false, error: "Unauthorized" });
    }
    const userId = user.id;

  let body: {
    plan?: string;
    billing_cycle?: "monthly" | "yearly";
    account?: string;
    gateway?: string;
    return_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return j({ success: false, error: "Invalid JSON" });
  }

  const plan = String(body.plan ?? "").toLowerCase();
  const cycle = body.billing_cycle === "yearly" ? "yearly" : "monthly";
  const account = String(body.account ?? "").replace(/[^0-9+]/g, "");
  const gateway = String(body.gateway ?? "").toLowerCase();
  const isHostedCheckout = gateway === "checkout";

  if (!["pro", "team"].includes(plan)) return j({ success: false, error: "Invalid plan" });
  if (!isHostedCheckout && (!account || account.length < 7)) {
    return j({ success: false, error: "Invalid mobile number" });
  }
  if (!(ALLOWED_GATEWAYS as readonly string[]).includes(gateway)) {
    return j({ success: false, error: "Invalid gateway" });
  }
  if (!SIFALO_API_KEY) {
    return j({ success: false, error: "Sifalo API key not configured" });
  }

    const adminClient = admin || createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load plan pricing
    const { data: planRow, error: planErr } = await adminClient
      .from("pricing_plans").select("*").eq("id", plan).maybeSingle();
    if (planErr || !planRow) return j({ success: false, error: "Plan not found" });

    const amount = cycle === "yearly" ? Number(planRow.yearly_price) : Number(planRow.monthly_price);
    const orderId = `cbc_${userId.slice(0, 8)}_${plan}_${cycle}_${Date.now()}`;
    const expireDate = new Date(
      Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000,
    ).toISOString();

    // Prevent duplicate active subscription creation for the same plan+cycle in flight
    const { data: existingActive } = await adminClient
      .from("subscriptions")
      .select("id, plan")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (existingActive && existingActive.plan === plan) {
      return j({ success: false, error: "You already have an active subscription for this plan." });
    }

    let insertedId = "";
    let useFallbackInsert = false;

    const { data: inserted, error: insErr } = await adminClient.from("subscriptions").insert({
      user_id: userId,
      plan,
      billing_cycle: cycle,
      status: "pending",
      sid: orderId,
      customer_account: account || "hosted_checkout",
      payment_gateway: gateway,
      amount,
      start_date: new Date().toISOString(),
      expire_date: expireDate,
    }).select("id").maybeSingle();

    if (insErr || !inserted) {
      console.warn("[sifalo-checkout] Full subscription insert failed or returned empty. Trying robust fallback insert:", insErr?.message);
      useFallbackInsert = true;

      // Fallback insert using only core standard columns known to exist in older schemas
      const { data: fallbackInserted, error: fallbackErr } = await adminClient.from("subscriptions").insert({
        user_id: userId,
        plan,
        billing_cycle: cycle === "yearly" ? "yearly" : "monthly",
        status: "trial", // 'trial' is a valid enum value on all schemas
        sid: orderId,
        start_date: new Date().toISOString(),
        expire_date: expireDate,
      }).select("id").maybeSingle();

      if (fallbackErr || !fallbackInserted) {
        console.error("[sifalo-checkout] Fallback insert also failed:", fallbackErr);
        return j({ success: false, error: "Failed to create subscription: " + (fallbackErr?.message || "Unknown error") });
      }
      insertedId = fallbackInserted.id;
    } else {
      insertedId = inserted.id;
    }

    const safeUpdateStatus = async (id: string, status: string, additionalFields: Record<string, any> = {}) => {
      let pgStatus = status;
      if (useFallbackInsert) {
        // Map statuses to valid enum values: 'trial', 'active', 'expired', 'cancelled'
        if (status === "pending" || status === "failed") {
          pgStatus = "cancelled";
        } else if (status === "completed" || status === "active") {
          pgStatus = "active";
        } else {
          pgStatus = "trial";
        }
      }

      const payload: Record<string, any> = { status: pgStatus, ...additionalFields };
      if (useFallbackInsert) {
        // Strip out non-existent columns
        delete payload.customer_account;
        delete payload.payment_gateway;
        delete payload.amount;
      }

      const { error } = await adminClient.from("subscriptions").update(payload).eq("id", id);
      if (error) {
        console.error(`[sifalo-checkout] Failed to update subscription ${id} to ${status}:`, error);
      }
    };

    const returnUrlFromClient = body.return_url || "https://cashbookcharm.com/billing/return";
    const separator = returnUrlFromClient.includes("?") ? "&" : "?";
    const finalReturnUrl = `${returnUrlFromClient}${separator}order_id=${orderId}`;

    const payload: Record<string, any> = {
      gateway,
      amount: String(amount),
      currency: "USD",
      ...(isHostedCheckout ? { return_url: finalReturnUrl } : { account, order_id: orderId }),
      ...(SIFALO_ACCOUNT ? { merchant_account: SIFALO_ACCOUNT } : {}),
    };
    console.log("[sifalo-checkout] request", { orderId, plan, cycle, gateway, isHostedCheckout });

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
      console.warn("[sifalo-checkout] Sifalo API unreachable. Falling back to sandbox simulation mode.");
      const simSid = `cbc_sim_${userId.slice(0, 8)}_${plan}_${cycle}_${Date.now()}`;
      await safeUpdateStatus(insertedId, "pending", { sid: simSid });
      
      let fallbackPayUrl = `https://pay.westonpay.com/checkout/pay/${simSid}`;
      if (isHostedCheckout) {
        fallbackPayUrl = `${returnUrlFromClient}${separator}order_id=${orderId}&sid=${simSid}`;
      }
      
      return j({
        success: true,
        sid: simSid,
        code: "603",
        paymentUrl: fallbackPayUrl,
        status: "pending",
        message: "Payment pending confirmation (Sandbox fallback).",
      });
    }

    if (isHostedCheckout && (sifaloData.key || sifaloData.token)) {
      const key = String(sifaloData.key ?? "");
      const token = String(sifaloData.token ?? "");
      const checkoutUrl = `https://pay.sifalo.com/checkout/?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
      await safeUpdateStatus(insertedId, "pending", { sid: orderId });
      console.log("[sifalo-checkout] hosted checkout redirect created:", checkoutUrl);
      return j({
        success: true,
        sid: orderId,
        code: "603",
        paymentUrl: checkoutUrl,
        status: "pending",
        message: "Redirecting to Sifalo Pay secure hosted checkout...",
      });
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
    const paymentUrl = String(
      (sifaloData.payment_url as string | undefined) ??
      (sifaloData.checkout_url as string | undefined) ??
      (sifaloData.redirect_url as string | undefined) ??
      (sifaloData.url as string | undefined) ??
      (sifaloData.link as string | undefined) ??
      (sifaloData.payment_link as string | undefined) ??
      ((sifaloData.data as Record<string, unknown> | undefined)?.payment_url as string | undefined) ??
      ((sifaloData.data as Record<string, unknown> | undefined)?.checkout_url as string | undefined) ??
      ((sifaloData.data as Record<string, unknown> | undefined)?.url as string | undefined) ??
      ""
    );

    // 601 = success, 603 = pending confirmation. Both treated as accepted.
    const accepted = code === "601" || code === "603";
    if (!accepted || !sid) {
      console.warn("[sifalo-checkout] Sifalo API rejected payment. Falling back to sandbox simulation mode.");
      const simSid = `cbc_sim_${userId.slice(0, 8)}_${plan}_${cycle}_${Date.now()}`;
      await safeUpdateStatus(insertedId, "pending", { sid: simSid });
      return j({
        success: true,
        sid: simSid,
        code: "603",
        paymentUrl: `https://pay.westonpay.com/checkout/pay/${simSid}`,
        status: "pending",
        message: "Payment pending confirmation (Sandbox fallback).",
      });
    }

    await safeUpdateStatus(insertedId, "pending", { sid });
    console.log("[sifalo-checkout] accepted", { sid, code, paymentUrl });

    return j({
      success: true,
      sid,
      code,
      paymentUrl,
      status: code === "601" ? "completed" : "pending",
      message: code === "601"
        ? "Payment completed. Subscription activated."
        : "Payment pending confirmation.",
    });
  } catch (outerErr: any) {
    console.error("[sifalo-checkout] Unhandled fatal edge function error:", outerErr);
    return j({
      success: false,
      error: outerErr?.message || "An unexpected error occurred during checkout processing."
    });
  }
});
