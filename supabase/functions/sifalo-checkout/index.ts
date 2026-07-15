import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SIFALO_API_KEY = Deno.env.get("SIFALO_API_KEY") || "";
const SIFALO_ACCOUNT = Deno.env.get("SIFALO_MERCHANT_ACCOUNT") || "";

const SIFALO_API = "https://api.sifalopay.com/gateway/";

const ALLOWED_GATEWAYS = ["waafi", "edahab", "pbwallet", "checkout"] as const;

const json = (b: Record<string, unknown>) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return json({ success: false, error: "Unauthorized" });

    if (!SUPABASE_URL || !ANON || !SERVICE_ROLE)
      throw new Error("Supabase env not configured");
    if (!SIFALO_API_KEY)
      return json({ success: false, error: "Sifalo API key not configured" });

    // Authenticate user
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !authData?.user)
      return json({ success: false, error: "Unauthorized" });
    const userId = authData.user.id;

    // Parse body
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
      return json({ success: false, error: "Invalid JSON" });
    }

    const plan = String(body.plan ?? "").toLowerCase();
    const cycle: "monthly" | "yearly" =
      body.billing_cycle === "yearly" ? "yearly" : "monthly";
    const account = String(body.account ?? "").replace(/[^0-9+]/g, "");
    const gateway = String(body.gateway ?? "").toLowerCase();
    const isHostedCheckout = gateway === "checkout";

    if (!["pro", "team"].includes(plan))
      return json({ success: false, error: "Invalid plan" });
    if (!isHostedCheckout && (!account || account.length < 7))
      return json({ success: false, error: "Invalid mobile number" });
    if (!(ALLOWED_GATEWAYS as readonly string[]).includes(gateway))
      return json({ success: false, error: "Invalid gateway" });

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load plan pricing
    const { data: planRow, error: planErr } = await adminClient
      .from("pricing_plans")
      .select("*")
      .eq("id", plan)
      .maybeSingle();
    if (planErr || !planRow)
      return json({ success: false, error: "Plan not found" });

    const amount =
      cycle === "yearly"
        ? Number(planRow.yearly_price)
        : Number(planRow.monthly_price);
    const orderId = `cbc_${userId.slice(0, 8)}_${plan}_${cycle}_${Date.now()}`;
    const expireDate = new Date(
      Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000,
    ).toISOString();

    // Prevent duplicate active subscription
    const { data: existingActive } = await adminClient
      .from("subscriptions")
      .select("id, plan")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (existingActive && existingActive.plan === plan)
      return json({
        success: false,
        error: "You already have an active subscription for this plan.",
      });

    // Create pending subscription
    const { data: inserted, error: insErr } = await adminClient
      .from("subscriptions")
      .insert({
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
      })
      .select("id")
      .maybeSingle();

    if (insErr || !inserted)
      return json({
        success: false,
        error: "Failed to create subscription: " + (insErr?.message || "Unknown"),
      });

    const subId = inserted.id;

    // Build return URL — Sifalo will redirect here after payment
    const returnUrlFromClient =
      body.return_url || `${SUPABASE_URL.replace(".supabase.co", "")}/payment-success`;
    // Always use the app's own payment-success page
    const appOrigin = req.headers.get("origin") || req.headers.get("referer") || "";
    const baseUrl = appOrigin
      ? new URL(appOrigin).origin
      : "https://cashbookcharm.com";
    const finalReturnUrl = `${baseUrl}/payment-success?order_id=${orderId}`;

    // Build Sifalo API payload
    const payload: Record<string, unknown> = {
      gateway,
      amount: String(amount),
      currency: "USD",
      ...(isHostedCheckout
        ? { return_url: finalReturnUrl }
        : { account, order_id: orderId }),
      ...(SIFALO_ACCOUNT ? { merchant_account: SIFALO_ACCOUNT } : {}),
    };

    console.log("[sifalo-checkout] request", { orderId, plan, cycle, gateway, amount });

    let sifaloData: Record<string, unknown> = {};
    let sifaloStatus = 0;
    let sifaloRaw = "";
    try {
      const res = await fetch(SIFALO_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${SIFALO_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      sifaloStatus = res.status;
      sifaloRaw = await res.text();
      try {
        sifaloData = JSON.parse(sifaloRaw);
      } catch {
        /* non-JSON response */
      }
      console.log("[sifalo-checkout] response", sifaloStatus, sifaloRaw.slice(0, 500));
    } catch (e) {
      console.error("[sifalo-checkout] Sifalo API unreachable:", e);
      return json({
        success: false,
        error: "Payment gateway is currently unreachable. Please try again.",
      });
    }

    // Hosted checkout: Sifalo returns key+token for redirect URL
    if (isHostedCheckout && (sifaloData.key || sifaloData.token)) {
      const key = String(sifaloData.key ?? "");
      const token = String(sifaloData.token ?? "");
      const checkoutUrl = `https://pay.sifalo.com/checkout/?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`;
      console.log("[sifalo-checkout] hosted checkout URL:", checkoutUrl);
      return json({
        success: true,
        sid: orderId,
        code: "603",
        paymentUrl: checkoutUrl,
        status: "pending",
        message: "Redirecting to Sifalo Pay secure checkout...",
      });
    }

    // Direct wallet push: Sifalo returns sid + code
    const code = String(
      (sifaloData.code as string | undefined) ??
        (sifaloData.status as string | undefined) ??
        "",
    );
    const sid = String(
      (sifaloData.sid as string | undefined) ??
        ((sifaloData.data as Record<string, unknown> | undefined)?.sid as
          | string
          | undefined) ??
        "",
    );
    const message = String(
      (sifaloData.response as string | undefined) ??
        (sifaloData.message as string | undefined) ??
        "Payment request processed",
    );
    const paymentUrl = String(
      (sifaloData.payment_url as string | undefined) ??
        (sifaloData.checkout_url as string | undefined) ??
        (sifaloData.redirect_url as string | undefined) ??
        (sifaloData.url as string | undefined) ??
        (sifaloData.link as string | undefined) ??
        (sifaloData.payment_link as string | undefined) ??
        ((sifaloData.data as Record<string, unknown> | undefined)
          ?.payment_url as string | undefined) ??
        ((sifaloData.data as Record<string, unknown> | undefined)
          ?.checkout_url as string | undefined) ??
        "",
    );

    // 601 = success, 603 = pending confirmation
    const accepted = code === "601" || code === "603";
    if (!accepted) {
      // Update subscription to failed
      await adminClient
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subId);
      return json({
        success: false,
        error: message || "Payment request was rejected by the gateway.",
        code,
        sifaloResponse: sifaloData,
      });
    }

    // Update subscription with real Sifalo SID
    await adminClient
      .from("subscriptions")
      .update({ sid: sid || orderId })
      .eq("id", subId);

    return json({
      success: true,
      sid: sid || orderId,
      code,
      paymentUrl,
      status: code === "601" ? "completed" : "pending",
      message:
        code === "601"
          ? "Payment completed. Subscription activated."
          : "Payment pending confirmation. Please approve the prompt on your phone.",
    });
  } catch (outerErr: any) {
    console.error("[sifalo-checkout] fatal error:", outerErr);
    return json({
      success: false,
      error:
        outerErr?.message ||
        "An unexpected error occurred during checkout processing.",
    });
  }
});
