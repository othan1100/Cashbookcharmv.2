// Whop webhook handler — auto-upgrades user plans on successful payments.
// Public endpoint (no JWT). Verifies HMAC signature using WHOP_WEBHOOK_SECRET.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-whop-signature",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WHOP_SECRET = Deno.env.get("WHOP_WEBHOOK_SECRET") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!WHOP_SECRET) return true; // if not configured, accept (dev)
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(WHOP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  // accept either raw hex or "sha256=..." style
  const provided = signature.replace(/^sha256=/, "").trim().toLowerCase();
  return provided === hex;
}

// Map Whop plan/product identifier to our plan_type. Customize as needed.
function detectPlan(payload: any): "pro" | "team" | null {
  const blob = JSON.stringify(payload).toLowerCase();
  if (blob.includes("team")) return "team";
  if (blob.includes("pro")) return "pro";
  return null;
}

function extractEmail(p: any): string | null {
  return p?.data?.user?.email ?? p?.user?.email ?? p?.email ?? p?.data?.email ?? null;
}
function extractWhopUserId(p: any): string | null {
  return p?.data?.user_id ?? p?.data?.user?.id ?? p?.user_id ?? p?.user?.id ?? null;
}
function extractEventId(p: any): string | null {
  return p?.id ?? p?.event_id ?? p?.data?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-whop-signature") ?? req.headers.get("whop-signature");
  const ok = await verifySignature(raw, sig);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType = payload?.action ?? payload?.type ?? payload?.event ?? "unknown";
  const eventId = extractEventId(payload);
  const whopUserId = extractWhopUserId(payload);
  const email = extractEmail(payload);
  const plan = detectPlan(payload);

  // Log event (idempotent on event_id)
  const { data: logged } = await admin.from("whop_events").insert({
    event_id: eventId,
    event_type: String(eventType),
    whop_user_id: whopUserId,
    plan_type: plan,
    payload,
  }).select("id").maybeSingle();

  // Only upgrade on successful payment / membership active events
  const successEvents = ["payment.succeeded", "membership.went_valid", "membership.created", "checkout.completed"];
  const isSuccess = successEvents.some(e => String(eventType).toLowerCase().includes(e.split(".")[0]) && String(eventType).toLowerCase().includes(e.split(".")[1] ?? ""));

  if (!isSuccess || !plan) {
    return new Response(JSON.stringify({ ok: true, ignored: true, eventType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find user: by whop_user_id first, then by email
  let userId: string | null = null;
  if (whopUserId) {
    const { data } = await admin.from("profiles").select("user_id").eq("whop_user_id", whopUserId).maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId && email) {
    const { data: list } = await admin.auth.admin.listUsers();
    const found = list?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      userId = found.id;
      if (whopUserId) {
        await admin.from("profiles").update({ whop_user_id: whopUserId }).eq("user_id", userId);
      }
    }
  }

  if (!userId) {
    await admin.from("whop_events").update({ error: "user not found", processed: false }).eq("id", logged?.id);
    return new Response(JSON.stringify({ ok: false, error: "user not found", email }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: upErr } = await admin.from("profiles").update({
    plan_type: plan,
    plan_updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await admin.from("whop_events").update({
    user_id: userId,
    processed: !upErr,
    error: upErr?.message ?? null,
  }).eq("id", logged?.id);

  return new Response(JSON.stringify({ ok: !upErr, userId, plan }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
