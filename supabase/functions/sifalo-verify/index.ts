// Verifies a Sifalo Pay SID and activates the matching subscription.
// Idempotent — repeated calls for the same SID won't re-activate.
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

const json = (b: Record<string, unknown>) =>
  new Response(JSON.stringify(b), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return json({ ok: false, error: "Unauthorized" });

    if (!SUPABASE_URL || !ANON || !SERVICE_ROLE)
      throw new Error("Supabase env not configured");
    if (!SIFALO_API_KEY)
      return json({ ok: false, error: "Sifalo API key not configured" });

    // Authenticate user
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !authData?.user)
      return json({ ok: false, error: "Unauthorized" });
    const userId = authData.user.id;

    // Parse body
    let body: { sid?: string; order_id?: string };
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" });
    }

    const sid = String(body.sid ?? "").trim();
    const orderId = String(body.order_id ?? "").trim();
    if (!sid && !orderId)
      return json({ ok: false, error: "sid or order_id required" });

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Find subscription by sid or order_id, scoped to the authenticated user
    let sub = null;
    const lookupKey = sid || orderId;
    const { data: foundSub } = await adminClient
      .from("subscriptions")
      .select("*")
      .eq("sid", lookupKey)
      .eq("user_id", userId)
      .maybeSingle();
    sub = foundSub;

    if (!sub && orderId && orderId !== sid) {
      const { data: foundByOrder } = await adminClient
        .from("subscriptions")
        .select("*")
        .eq("sid", orderId)
        .eq("user_id", userId)
        .maybeSingle();
      sub = foundByOrder;
    }

    if (!sub)
      return json({ ok: false, error: "Subscription not found for this reference" });

    // Already active — idempotent return
    if (sub.status === "active") {
      return json({
        ok: true,
        already_active: true,
        plan: sub.plan,
        expire_date: sub.expire_date,
        code: "601",
        status: "success",
        sid: sub.sid,
      });
    }

    // Call Sifalo verify API
    let verified = false;
    let sifaloCode = "";
    let sifaloStatus = "";
    let sifaloPaymentType = "";
    let sifaloAmount = "";

    try {
      const verifyBody: Record<string, string> = {};
      if (sid) verifyBody.sid = sid;
      else if (orderId) verifyBody.order_id = orderId;

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

      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(raw);
      } catch {
        /* non-JSON */
      }

      const code = String(
        (data.code as string | undefined) ??
          (data.payment_code as string | undefined) ??
          "",
      );
      const status = String(
        (data.status as string | undefined) ??
          (data.payment_status as string | undefined) ??
          "",
      ).toLowerCase();

      sifaloCode = code;
      sifaloStatus = status;
      sifaloPaymentType = String(data.payment_type ?? data.gateway ?? "");
      sifaloAmount = String(data.amount ?? "");

      // Sifalo: 601 = success
      verified =
        code === "601" ||
        ["success", "paid", "completed", "active"].some((s) =>
          status.includes(s),
        );
    } catch (e) {
      console.error("[sifalo-verify] API error:", e);
      verified = false;
    }

    if (!verified) {
      return json({
        ok: false,
        error: "Payment not confirmed yet. If you've completed payment, please wait a moment and try again.",
        code: sifaloCode || "602",
        status: sifaloStatus || "pending",
        payment_type: sifaloPaymentType,
        amount: sifaloAmount,
        sid: sid || orderId,
      });
    }

    // Activate subscription
    const cycle = sub.billing_cycle === "yearly" ? "yearly" : "monthly";
    const expire = new Date(
      Date.now() + (cycle === "yearly" ? 365 : 30) * 86400_000,
    ).toISOString();

    const { error: subErr } = await adminClient
      .from("subscriptions")
      .update({
        status: "active",
        start_date: new Date().toISOString(),
        expire_date: expire,
      })
      .eq("id", sub.id);
    if (subErr) console.error("[sifalo-verify] sub update error:", subErr);

    // Update profile plan
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        plan_type: sub.plan,
        plan_updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (profileErr)
      console.error("[sifalo-verify] profile update error:", profileErr);

    console.log("[sifalo-verify] activated", { userId, plan: sub.plan });

    return json({
      ok: true,
      plan: sub.plan,
      expire_date: expire,
      code: sifaloCode || "601",
      status: sifaloStatus || "success",
      payment_type: sifaloPaymentType,
      amount: sifaloAmount,
      sid: sub.sid || sid || orderId,
    });
  } catch (outerErr: any) {
    console.error("[sifalo-verify] fatal error:", outerErr);
    return json({
      ok: false,
      error:
        outerErr?.message ||
        "An unexpected error occurred during verification.",
    });
  }
});
