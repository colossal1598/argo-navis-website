import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

/*
  This file must NOT be pre-rendered — it needs to run on the server
  every time a form is submitted, so Cloudflare executes it as a Worker.
*/
export const prerender = false;

/*
  SUPABASE TABLE NAME — change this if your table is named differently.
  The table must have at least these columns:
    name    text
    email   text
    contact_method text
    message text
    source  text   (which page / form type the lead came from)

  The SQL to create it is in the README under "Supabase Setup".
*/
const TABLE = "leads";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/*
  POST handler — called when the ContactForm submits.
  Astro automatically routes POST /api/leads here.
*/
export const POST: APIRoute = async ({ request }) => {
  /*
    Parse the incoming JSON body sent by the form's fetch() call.
    Expected shape: { name, email, website, contact_method, contact_details, message, source }
  */
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { name, email, website, message, source = "landing", contact_method: contactMethod, contact_details: contactDetails } = body;
  const turnstileToken = body["cf-turnstile-response"] ?? body.turnstileToken;
  const turnstileSecret = import.meta.env.TURNSTILE_SECRET_KEY;
  const isProd = import.meta.env.PROD;

  if (isProd && !turnstileSecret) {
    console.error("TURNSTILE_SECRET_KEY is missing in production.");
    return json({ error: "Security verification is unavailable. Please try again later." }, 500);
  }

  if (isProd && !turnstileToken) {
    return json({ error: "Please complete the verification challenge." }, 400);
  }

  if (turnstileSecret && turnstileToken) {
    const turnstileRes = await verifyTurnstile(
      turnstileToken,
      turnstileSecret,
      request.headers.get("cf-connecting-ip") ?? undefined,
    );

    if (!turnstileRes.success) {
      return json({ error: "Verification failed. Please try again." }, 400);
    }
  } else if (isProd) {
    return json({ error: "Please complete the verification challenge." }, 400);
  }

  /* ── Basic validation ── */
  if (!name?.trim())    return json({ error: "Name is required." }, 400);
  if (!email?.trim())   return json({ error: "Email is required." }, 400);
  if (!message?.trim()) return json({ error: "Please tell us what you need." }, 400);

  const emailValue = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  if (!emailValid) return json({ error: "Please enter a valid email." }, 400);

  const allowedContactMethods = new Set(["whatsapp", "telegram", "phone", "email"]);
  const preferredContactMethod = allowedContactMethods.has((contactMethod || "").trim())
    ? (contactMethod || "").trim()
    : "email";
  const normalizedContactDetails = contactDetails?.trim() || null;
  if (preferredContactMethod !== "email" && !normalizedContactDetails) {
    return json({ error: "Please provide your contact details for the selected method." }, 400);
  }

  /* ── Insert into Supabase ── */
  const { error } = await supabase.from(TABLE).insert({
    name:    name.trim(),
    email: emailValue,
    website: website?.trim() || null,  /* optional — null if not provided */
    contact_method: preferredContactMethod,
    contact_details: preferredContactMethod === "email" ? null : normalizedContactDetails,
    message: message.trim(),
    source,
  });

  if (error) {
    console.error("Supabase insert error:", error.message);
    return json({ error: "Could not save your message. Please try again." }, 500);
  }

  return json({ success: true }, 200);
};

/* Small helper to avoid repeating new Response(...) everywhere */
function json(data: object, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface TurnstileVerifyResponse {
  success: boolean;
}

async function verifyTurnstile(
  token: string,
  secret: string,
  remoteIp?: string,
): Promise<TurnstileVerifyResponse> {
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteIp) {
      form.append("remoteip", remoteIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      return { success: false };
    }

    const json = await response.json();
    return { success: Boolean(json.success) };
  } catch {
    return { success: false };
  }
}
