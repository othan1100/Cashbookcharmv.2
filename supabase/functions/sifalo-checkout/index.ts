import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SIFALO_API_KEY = Deno.env.get("SIFALO_API_KEY") || "";
const SIFALO_API_USERNAME =
  Deno.env.get("SIFALO_API_USERNAME") ||
  Deno.env.get("SIFALO_USERNAME") ||
  Deno.env.get("API Username") ||
  "";

const SIFALO_GATEWAY_URL = "https://api.sifalopay.com/gateway/";
const SIFALO_CHECKOUT_URL = "https://pay.sifalo.com/checkout/";

const json = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Sifalo uses HTTP Basic auth with username:apikey (base64-encoded).
function basicAuthHeader(): string {
  const raw = SIFALO_API_USERNAME
    ? `${SIFALO_API_USERNAME}:${SIFALO_API_KEY}`
    : SIFALO_API_KEY;
  return `Basic ${btoa(raw)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return json({ success: false, error: "Unauthorized" }, 401);

    if (!SUPABASE_URL || !ANON || !SERVICE_ROLE)
      return json({ success: false, error: "Server not configured" }, 500);
    if (!SIFALO_API_KEY)
      return json({ success: false, error: "Sifalo API key not configured" }, 500);

    // Authenticate user via their JWT
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !authData?.user)
      return json({ success: false, error: "Unauthorized" }, 401);
    const userId = authData.user.id;

    // Parse body
    let body: {
      plan?: string;
      billing_cycle?: "monthly" | "yearly";
      return_url?: string;
      cancel_url?: string;
    };
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "Invalid JSON" }, 400);
    }

    const plan = String(body.plan ?? "").toLowerCase();
    const cycle: "monthly" | "yearly" =
      body.billing_cycle === "yearly" ? "yearly" : "monthly";

    if (!["pro", "team"].includes(plan))
      return json({ success: false, error: "Invalid plan. Choose pro or team." }, 400);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load plan pricing from database
    const { data: planRow, error: planErr } = await adminClient
      .from("pricing_plans")
      .select("id, name, monthly_price, yearly_price")
      .eq("id", plan)
      .maybeSingle();
    if (planErr || !planRow)
      return json({ success: false, error: "Plan not found" }, 404);

    const amount =
      cycle === "yearly"
        ? Number(planRow.yearly_price)
        : Number(planRow.monthly_price);

    if (!amount || amount <= 0)
      return json({ success: false, error: "Invalid plan price" }, 400);

    // Generate a unique order_id
    const orderId = `cbc_${userId.slice(0, 8)}_${plan}_${cycle}_${Date.now()}`;

    // Build return + cancel URLs — Sifalo redirects here after payment with ?sid=...
    const appOrigin = req.headers.get("origin") || req.headers.get("referer") || "";
    const baseUrl = appOrigin ? new URL(appOrigin).origin : "https://cashbookcharm.com";
    const returnUrl = `${baseUrl}/payment-success?order_id=${orderId}`;
    const cancelUrl = `${baseUrl}/payment-cancelled?order_id=${orderId}`;

    // Create pending subscription record
    const { data: inserted, error: insErr } = await adminClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        plan,
        billing_cycle: cycle,
        status: "pending",
        order_id: orderId,
        amount,
      })
      .select("id")
      .maybeSingle();

    if (insErr || !inserted)
      return json({
        success: false,
        error: "Failed to create subscription: " + (insErr?.message || "Unknown"),
      }, 500);

    // Call Sifalo Pay Checkout API per docs:
    // POST https://api.sifalopay.com/gateway/
    // Body: { amount, gateway: "checkout", currency: "USD", return_url, cancel_url }
    // Auth: Basic Auth with username:api_key
    const sifaloPayload = {
      amount: String(amount),
      gateway: "checkout",
      currency: "USD",
      return_url: returnUrl,
      cancel_url: cancelUrl,
    };

    console.log("[sifalo-checkout] request", { orderId, plan, cycle, amount, returnUrl, cancelUrl });

    let sifaloData: Record<string, unknown> = {};
    try {
      const res = await fetch(SIFALO_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: basicAuthHeader(),
        },
        body: JSON.stringify(sifaloPayload),
      });
      const raw = await res.text();
      console.log("[sifalo-checkout] response", res.status, raw.slice(0, 500));

      if (!res.ok) {
        // Update subscription to failed
        await adminClient
          .from("subscriptions")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", inserted.id);

        let errMsg = "Payment gateway rejected the request";
        try {
          const errData = JSON.parse(raw);
          errMsg = errData?.error || errData?.message || errMsg;
        } catch { /* non-JSON error response */ }

        return json({ success: false, error: errMsg, sifaloStatus: res.status }, 502);
      }

      try {
        sifaloData = JSON.parse(raw);
      } catch {
        return json({ success: false, error: "Invalid response from payment gateway" }, 502);
      }
    } catch (e) {
      console.error("[sifalo-checkout] Sifalo API unreachable:", e);
      await adminClient
        .from("subscriptions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", inserted.id);
      return json({
        success: false,
        error: "Payment gateway is currently unreachable. Please try again.",
      }, 502);
    }

    // Per docs: response contains { key, token }
    const key = String(sifaloData.key ?? "");
    const tokenVal = String(sifaloData.token ?? "");

    if (!key || !tokenVal) {
      await adminClient
        .from("subscriptions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", inserted.id);
      return json({
        success: false,
        error: "Payment gateway did not return checkout credentials",
        sifaloResponse: sifaloData,
      }, 502);
    }

    // Build the checkout URL per docs:
    // https://pay.sifalo.com/checkout/?key=...&token=...
    const checkoutUrl = `${SIFALO_CHECKOUT_URL}?key=${encodeURIComponent(key)}&token=${encodeURIComponent(tokenVal)}`;

    console.log("[sifalo-checkout] checkout URL built for order", orderId);

    return json({
      success: true,
      sid: orderId,
      paymentUrl: checkoutUrl,
      status: "pending",
      message: "Redirecting to Sifalo Pay secure checkout...",
    });
  } catch (outerErr: any) {
    console.error("[sifalo-checkout] fatal error:", outerErr);
    return json({
      success: false,
      error: outerErr?.message || "An unexpected error occurred during checkout.",
    }, 500);
  }
});
