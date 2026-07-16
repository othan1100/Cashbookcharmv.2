// Sifalo Pay webhook — auto-upgrades user plans on successful payments.
// Public endpoint (no JWT). Verifies HMAC SHA-256 signature against SIFALO_API_KEY
// (or override with a dedicated SIFALO_WEBHOOK_SECRET if provided).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sifalo-signature, sifalo-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIFALO_SECRET =
  Deno.env.get("SIFALO_WEBHOOK_SECRET") ?? Deno.env.get("SIFALO_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!SIFALO_SECRET) return true; // dev mode
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(SIFALO_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  const provided = signature.replace(/^sha256=/, "").trim().toLowerCase();
  return provided === hex;
}

// deno-lint-ignore no-explicit-any
function detectPlan(payload: any): "pro" | "team" | null {
  const blob = JSON.stringify(payload).toLowerCase();
  if (blob.includes("team")) return "team";
  if (blob.includes("pro")) return "pro";
  return null;
}
// deno-lint-ignore no-explicit-any
const extractEmail = (p: any): string | null =>
  p?.data?.customer?.email ?? p?.data?.user?.email ?? p?.customer?.email ?? p?.user?.email ?? p?.email ?? null;
// deno-lint-ignore no-explicit-any
const extractEventId = (p: any): string | null =>
  p?.id ?? p?.event_id ?? p?.data?.id ?? null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-sifalo-signature") ?? req.headers.get("sifalo-signature");
  const ok = await verifySignature(raw, sig);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // deno-lint-ignore no-explicit-any
  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType: string = payload?.event ?? payload?.type ?? payload?.action ?? "unknown";
  const eventId = extractEventId(payload);
  const email = extractEmail(payload);
  const plan = detectPlan(payload);

  // Log event (we reuse the whop_events table as a generic provider event log)
  const { data: logged } = await admin.from("whop_events").insert({
    event_id: eventId,
    event_type: `sifalo.${String(eventType)}`,
    plan_type: plan,
    payload,
  }).select("id").maybeSingle();

  const lower = String(eventType).toLowerCase();
  const isSuccess = ["payment.success", "payment.succeeded", "checkout.completed", "subscription.active", "subscription.created"]
    .some((e) => lower.includes(e));

  if (!isSuccess || !plan || !email) {
    return new Response(JSON.stringify({ ok: true, ignored: true, eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: list } = await admin.auth.admin.listUsers();
  const found = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!found) {
    await admin.from("whop_events").update({ error: "user not found", processed: false }).eq("id", logged?.id);
    return new Response(JSON.stringify({ ok: false, error: "user not found", email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: upErr } = await admin.from("profiles").update({
    plan_type: plan, plan_updated_at: new Date().toISOString(),
  }).eq("user_id", found.id);

  await admin.from("whop_events").update({
    user_id: found.id, processed: !upErr, error: upErr?.message ?? null,
  }).eq("id", logged?.id);

  return new Response(JSON.stringify({ ok: !upErr, userId: found.id, plan }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
