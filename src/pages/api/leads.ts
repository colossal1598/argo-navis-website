import type { APIRoute } from "astro";
import { Resend } from "resend";
import { createSupabaseClient } from "../../lib/supabase";

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
export const POST: APIRoute = async ({ request, locals }) => {
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
  const env = (locals.runtime as any).env;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
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
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);  const { error } = await supabase.from(TABLE).insert({
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

  /* ── Send emails via Resend ── */
  const resendKey = env.RESEND_API_KEY;
  const notifyEmail = env.NOTIFICATION_EMAIL;
  
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);

      /* 1. Auto-reply to the lead */
      await resend.emails.send({
        from: "Argo Navis <hello@argo-navis.net>",
        to: emailValue,
        subject: leadReplySubject(source),
        html: buildLeadReplyHtml({
          name: name.trim(),
          message: message.trim(),
          source,
          website: website?.trim() || null,
          preferredContactMethod,
          normalizedContactDetails,
        }),
      });

      /* 2. Owner notification */
      if (notifyEmail) {
        await resend.emails.send({
          from: "Argo Navis Leads <leads@argo-navis.net>",
          to: notifyEmail,
          subject: `New lead: ${name.trim()} via ${source}`,
          html: buildOwnerNotificationHtml({
            name: name.trim(),
            email: emailValue,
            website: website?.trim() || null,
            preferredContactMethod,
            normalizedContactDetails,
            message: message.trim(),
            source,
          }),
        });
      }
    } catch (emailError) {
      // Never blocks the form submission — lead is already saved to Supabase
      console.error("Resend error:", emailError);
    }
  }

  return json({ success: true }, 200);
};

/* ── Email helpers ── */

function leadReplySubject(source: string): string {
  const subjects: Record<string, string> = {
    websites:    "Your website brief is with us — Argo Navis",
    automations: "Your automation enquiry is with us — Argo Navis",
    campaigns:   "Your campaign brief is with us — Argo Navis",
  };
  return subjects[source] ?? "We got your message — Argo Navis";
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    websites:    "a new website",
    automations: "business automation",
    campaigns:   "a marketing campaign",
  };
  return labels[source] ?? "something great";
}

function contactMethodNote(method: string, details: string | null): string {
  if (method === "email") {
    return "We'll reply directly to this email address.";
  }
  const channelNames: Record<string, string> = {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    phone:    "phone",
  };
  const channel = channelNames[method] ?? method;
  return details
    ? `We'll reach out via ${channel} at <strong>${details}</strong>.`
    : `We'll reach out via ${channel}.`;
}

interface LeadReplyParams {
  name: string;
  message: string;
  source: string;
  website: string | null;
  preferredContactMethod: string;
  normalizedContactDetails: string | null;
}

function buildLeadReplyHtml(p: LeadReplyParams): string {
  const { name, message, source, website, preferredContactMethod, normalizedContactDetails } = p;
  const escapedMessage = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const websiteNote = website
    ? `<p style="margin:0 0 12px;">We'll take a look at <a href="${website}" style="color:#4f8ef7;">${website}</a> before we get back to you.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Argo Navis</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Navigation for modern business</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;">
            <p style="margin:0 0 20px;font-size:16px;color:#1e293b;">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
              Thanks for reaching out. We've received your enquiry about <strong>${sourceLabel(source)}</strong> and we're on it.
            </p>

            <!-- Message echo -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-left:3px solid #e2e8f0;padding:12px 16px;background:#f8fafc;border-radius:0 4px 4px 0;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Your message</p>
                  <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;white-space:pre-wrap;">${escapedMessage}</p>
                </td>
              </tr>
            </table>

            ${websiteNote}
            <p style="margin:0 0 12px;font-size:14px;color:#475569;">${contactMethodNote(preferredContactMethod, normalizedContactDetails)}</p>
            <p style="margin:0 0 28px;font-size:14px;color:#475569;">Expect to hear from us within <strong>24 hours</strong> on business days.</p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">

            <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
              – The Argo Navis team<br>
              <a href="mailto:hello@argo-navis.net" style="color:#4f8ef7;text-decoration:none;">hello@argo-navis.net</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              You're receiving this because you submitted a form at
              <a href="https://argo-navis.net" style="color:#94a3b8;">argo-navis.net</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

interface OwnerNotificationParams {
  name: string;
  email: string;
  website: string | null;
  preferredContactMethod: string;
  normalizedContactDetails: string | null;
  message: string;
  source: string;
}

function buildOwnerNotificationHtml(p: OwnerNotificationParams): string {
  const { name, email, website, preferredContactMethod, normalizedContactDetails, message, source } = p;
  const timestamp = new Date().toUTCString();
  const escapedMessage = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:8px 12px;font-size:13px;color:#64748b;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:8px 12px;font-size:13px;color:#1e293b;">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="background:#0f172a;padding:20px 24px;">
      <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;">New Lead — Argo Navis</p>
    </td></tr>
    <tr><td style="padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${row("Name", name)}
        ${row("Email", `<a href="mailto:${email}" style="color:#4f8ef7;">${email}</a>`)}
        ${row("Website", website ? `<a href="${website}" style="color:#4f8ef7;">${website}</a>` : "—")}
        ${row("Contact via", preferredContactMethod + (normalizedContactDetails ? ` — ${normalizedContactDetails}` : ""))}
        ${row("Source", source)}
        ${row("Time (UTC)", timestamp)}
        ${row("Message", `<span style="white-space:pre-wrap;">${escapedMessage}</span>`)}
      </table>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <a href="https://supabase.com/dashboard" style="font-size:12px;color:#4f8ef7;">View all leads in Supabase →</a>
    </td></tr>
  </table>
</body>
</html>`;
}

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
