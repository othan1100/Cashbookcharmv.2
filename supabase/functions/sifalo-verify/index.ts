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

const SIFALO_VERIFY_URL = "https://api.sifalopay.com/gateway/verify.php";

const json = (b: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return json({ ok: false, error: "Unauthorized" }, 401);

    if (!SUPABASE_URL || !ANON || !SERVICE_ROLE)
      return json({ ok: false, error: "Server not configured" }, 500);
    if (!SIFALO_API_KEY)
      return json({ ok: false, error: "Sifalo API key not configured" }, 500);

    // Authenticate user
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !authData?.user)
      return json({ ok: false, error: "Unauthorized" }, 401);
    const userId = authData.user.id;

    // Parse body
    let body: { sid?: string; order_id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400);
    }

    const sidParam = String(body.sid ?? "").trim();
    const orderIdParam = String(body.order_id ?? "").trim();

    if (!sidParam && !orderIdParam)
      return json({ ok: false, error: "sid or order_id required" }, 400);

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Find subscription by sid or order_id, scoped to the authenticated user
    let sub = null;
    const lookupKey = sidParam || orderIdParam;

    const { data: foundSub } = await adminClient
      .from("subscriptions")
      .select("*")
      .or(`sid.eq.${lookupKey},order_id.eq.${lookupKey}`)
      .eq("user_id", userId)
      .maybeSingle();
    sub = foundSub;

    if (!sub)
      return json({ ok: false, error: "Subscription not found for this reference" }, 404);

    // Already active — idempotent return
    if (sub.status === "active") {
      return json({
        ok: true,
        already_active: true,
        plan: sub.plan,
        expire_date: sub.expire_date,
        code: 601,
        status: "success",
        sid: sub.sid,
        amount: String(sub.amount ?? ""),
        payment_type: sub.payment_type ?? "",
      });
    }

    // Call Sifalo verify API per docs:
    // POST https://api.sifalopay.com/gateway/verify.php
    // Body: { sid } — if no sid, use order_id
    const verifyBody: Record<string, string> = {};
    if (sidParam) verifyBody.sid = sidParam;
    else if (orderIdParam) verifyBody.order_id = orderIdParam;

    console.log("[sifalo-verify] request", verifyBody);

    let sifaloData: Record<string, unknown> = {};
    let verified = false;

    try {
      const res = await fetch(SIFALO_VERIFY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${SIFALO_API_KEY}`,
        },
        body: JSON.stringify(verifyBody),
      });
      const raw = await res.text();
      console.log("[sifalo-verify] response", res.status, raw.slice(0, 500));

      try {
        sifaloData = JSON.parse(raw);
      } catch {
        return json({
          ok: false,
          error: "Invalid response from payment verification gateway",
        }, 502);
      }
    } catch (e) {
      console.error("[sifalo-verify] Sifalo API unreachable:", e);
      return json({
        ok: false,
        error: "Payment verification service is currently unreachable.",
      }, 502);
    }

    // Per docs: response contains { sid, account, payment_type, amount, status, code }
    const code = Number(sifaloData.code ?? 0);
    const status = String(sifaloData.status ?? "").toLowerCase();
    const sifaloSid = String(sifaloData.sid ?? "");
    const paymentType = String(sifaloData.payment_type ?? "");
    const amount = String(sifaloData.amount ?? "");

    // Per docs: code 601 = success, status "success"
    verified = code === 601 || status === "success";

    if (!verified) {
      // Update subscription with failed status if explicitly failed
      if (status === "failure") {
        await adminClient
          .from("subscriptions")
          .update({
            status: "failed",
            sid: sifaloSid || sidParam || undefined,
            payment_type: paymentType || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sub.id);
      }

      return json({
        ok: false,
        error: status === "failure"
          ? "Payment was declined or failed. Please try again."
          : "Payment not confirmed yet. If you've completed payment, please wait a moment and try again.",
        code: code || 602,
        status: status || "pending",
        payment_type: paymentType,
        amount,
        sid: sifaloSid || sidParam || orderIdParam,
      });
    }

    // Payment verified — activate subscription
    const cycle = sub.billing_cycle === "yearly" ? "yearly" : "monthly";
    const expire = new Date(
      Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000,
    ).toISOString();

    const { error: subErr } = await adminClient
      .from("subscriptions")
      .update({
        status: "active",
        sid: sifaloSid || sidParam || undefined,
        payment_type: paymentType || undefined,
        start_date: new Date().toISOString(),
        expire_date: expire,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
    if (subErr) console.error("[sifalo-verify] sub update error:", subErr);

    // Upgrade profile plan
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        plan_type: sub.plan,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (profileErr)
      console.error("[sifalo-verify] profile update error:", profileErr);

    console.log("[sifalo-verify] activated", { userId, plan: sub.plan, sid: sifaloSid });

    return json({
      ok: true,
      plan: sub.plan,
      expire_date: expire,
      code: code || 601,
      status: "success",
      payment_type: paymentType,
      amount,
      sid: sifaloSid || sidParam || orderIdParam,
    });
  } catch (outerErr: any) {
    console.error("[sifalo-verify] fatal error:", outerErr);
    return json({
      ok: false,
      error: outerErr?.message || "An unexpected error occurred during verification.",
    }, 500);
  }
});
