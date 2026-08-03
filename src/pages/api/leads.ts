import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
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
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  const isProd = import.meta.env.PROD;
  const hebrewSource = isHebrew(source);
  /* Bilingual error string — `en`/`he` pair, picked by the lead's own source tag. */
  const t = (en: string, he: string) => (hebrewSource ? he : en);

  /*
    Launch audit fix (Task 4.1, Critical): this used to hard-fail every
    submission whenever TURNSTILE_SECRET_KEY was unset (500 here) or
    unset-but-required (400 below) — meaning a missed Cloudflare Pages
    env var silently killed every lead on the site, not just bot
    protection. Now: verification only runs (and is only required) when
    a secret is actually configured; a missing secret degrades to "no
    bot check" instead of "no submissions possible." Mirrors the
    matching client-side fix in ContactForm.astro.
  */
  if (isProd && !turnstileSecret) {
    console.error("TURNSTILE_SECRET_KEY is missing in production — bot-check is disabled until it's configured.");
  }

  if (isProd && turnstileSecret && !turnstileToken) {
    return json({ error: t("Please complete the verification challenge.", "יש להשלים את אימות האבטחה.") }, 400);
  }

  if (turnstileSecret && turnstileToken) {
    const turnstileRes = await verifyTurnstile(
      turnstileToken,
      turnstileSecret,
      request.headers.get("cf-connecting-ip") ?? undefined,
    );

    if (!turnstileRes.success) {
      return json({ error: t("Verification failed. Please try again.", "האימות נכשל. נסו שוב.") }, 400);
    }
  }

  /* ── Basic validation ── */
  if (!name?.trim())    return json({ error: t("Name is required.", "יש להזין שם.") }, 400);
  if (!email?.trim())   return json({ error: t("Email is required.", "יש להזין כתובת אימייל.") }, 400);
  if (!message?.trim()) return json({ error: t("Please tell us what you need.", "ספרו לנו במה אתם צריכים עזרה.") }, 400);

  const emailValue = email.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  if (!emailValid) return json({ error: t("Please enter a valid email.", "יש להזין כתובת אימייל תקינה.") }, 400);

  const allowedContactMethods = new Set(["whatsapp", "telegram", "phone", "email"]);
  const preferredContactMethod = allowedContactMethods.has((contactMethod || "").trim())
    ? (contactMethod || "").trim()
    : "email";
  const normalizedContactDetails = contactDetails?.trim() || null;
  if (preferredContactMethod !== "email" && !normalizedContactDetails) {
    return json({ error: t("Please provide your contact details for the selected method.", "יש להזין פרטי יצירת קשר עבור אמצעי הקשר שנבחר.") }, 400);
  }

  /*
    ── Insert into Supabase ──
    Wrapped in try/catch: createSupabaseClient() throws synchronously when
    SUPABASE_URL / SUPABASE_SECRET_KEY are missing (e.g. .dev.vars not set
    up locally, or the vars unset/misconfigured in Cloudflare Pages). Without
    this guard that throw was unhandled and surfaced as a raw 500 error page
    instead of the same JSON error contract every other failure path uses.
  */
  let insertErrorMessage: string | null = null;
  try {
    const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY);
    const { error } = await supabase.from(TABLE).insert({
      name:    name.trim(),
      email: emailValue,
      website: website?.trim() || null,  /* optional — null if not provided */
      contact_method: preferredContactMethod,
      contact_details: preferredContactMethod === "email" ? null : normalizedContactDetails,
      message: message.trim(),
      source,
    });
    if (error) insertErrorMessage = error.message;
  } catch (err) {
    insertErrorMessage = err instanceof Error ? err.message : "Unknown Supabase client error";
  }

  if (insertErrorMessage) {
    console.error("Supabase insert error:", insertErrorMessage);
    return json({ error: t("Could not save your message. Please try again.", "לא הצלחנו לשמור את ההודעה. נסו שוב.") }, 500);
  }

  /* ── Send emails via Resend ── */
  const resendKey = env.RESEND_API_KEY;
  const hebrew = hebrewSource;

  if (resendKey) {
    try {
      const resend = new Resend(resendKey);

      /* 1. Auto-reply to the lead */
      await resend.emails.send({
        from: "Argo Navis <hello@argo-navis.net>",
        to: emailValue,
        subject: hebrew ? leadReplySubjectHe(source) : leadReplySubject(source),
        html: hebrew
          ? buildLeadReplyHtmlHe({
              name: name.trim(),
              message: message.trim(),
              source,
              website: website?.trim() || null,
              preferredContactMethod,
              normalizedContactDetails,
            })
          : buildLeadReplyHtml({
              name: name.trim(),
              message: message.trim(),
              source,
              website: website?.trim() || null,
              preferredContactMethod,
              normalizedContactDetails,
            }),
      });

      /* 2. Owner notification */
      await resend.emails.send({
        from: "Argo Navis Leads <leads@argo-navis.net>",
        to: "jason@argo-navis.net",
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
    landing:     "Your diagnostic conversation is with us — Argo Navis",
    websites:    "Your website brief is with us — Argo Navis",
    automations: "Your automation enquiry is with us — Argo Navis",
    systems:     "Your system brief is with us — Argo Navis",
    "ai-agents": "Your AI enquiry is with us — Argo Navis",
    "lp-spreadsheets":           "Your spreadsheet diagnostic is with us — Argo Navis",
    "systems-fuel-distribution": "Your diagnostic conversation is with us — Argo Navis",
    "lp-ai-agents":              "Your AI diagnostic is with us — Argo Navis",
    "lp-connected-systems":      "Your systems diagnostic is with us — Argo Navis",
    "lp-missed-calls":           "Your missed-calls diagnostic is with us — Argo Navis",
    "automations-travel-agency": "Your diagnostic conversation is with us — Argo Navis",
    "systems-marketing-agency":  "Your diagnostic conversation is with us — Argo Navis",
    "automations-reception":     "Your diagnostic conversation is with us — Argo Navis",
  };
  return subjects[source] ?? "We got your message — Argo Navis";
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    landing:     "bringing order to your business",
    websites:    "a new website",
    automations: "business automation",
    systems:     "a new system",
    "ai-agents": "an AI tool",
    "lp-spreadsheets":           "moving off your spreadsheets",
    "systems-fuel-distribution": "a custom system for your business",
    "lp-ai-agents":              "figuring out if AI helps your business",
    "lp-connected-systems":      "connecting your systems",
    "lp-missed-calls":           "not missing another call",
    "automations-travel-agency": "a custom system for your business",
    "systems-marketing-agency":  "a custom system for your business",
    "automations-reception":     "a custom system for your business",
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

/* ── Hebrew email helpers ── */

function isHebrew(source: string): boolean {
  return source.includes("-he") || source.startsWith("he-");
}

function leadReplySubjectHe(source: string): string {
  const subjects: Record<string, string> = {
    "landing-he":     "קיבלנו את הפנייה שלך לשיחת אבחון — Argo Navis",
    "websites-he":    "קיבלנו את הבריף שלך לאתר — Argo Navis",
    "automations-he": "קיבלנו את הפנייה שלך לאוטומציה — Argo Navis",
    "systems-he":     "קיבלנו את הבריף שלך למערכת — Argo Navis",
    "ai-agents-he":   "קיבלנו את הפנייה שלך ל-AI — Argo Navis",
    "lp-spreadsheets-he":           "קיבלנו את הפנייה שלך על הגיליונות — Argo Navis",
    "systems-fuel-distribution-he": "קיבלנו את הפנייה שלך לשיחת אבחון — Argo Navis",
    "lp-ai-agents-he":              "קיבלנו את הפנייה שלך בנושא AI — Argo Navis",
    "lp-connected-systems-he":      "קיבלנו את הפנייה שלך לחיבור המערכות — Argo Navis",
    "lp-missed-calls-he":           "קיבלנו את הפנייה שלך על שיחות שהוחמצו — Argo Navis",
    "automations-travel-agency-he": "קיבלנו את הפנייה שלך לשיחת אבחון — Argo Navis",
    "systems-marketing-agency-he":  "קיבלנו את הפנייה שלך לשיחת אבחון — Argo Navis",
    "automations-reception-he":     "קיבלנו את הפנייה שלך לשיחת אבחון — Argo Navis",
    "lp-order-he":                  "קיבלנו את הפנייה שלך — Argo Navis",
    "lp-tried-before-he":           "קיבלנו את הפנייה שלך — Argo Navis",
    "lp-stop-the-leaks-he":         "קיבלנו את הפנייה שלך — Argo Navis",
    "lp-runs-itself-he":            "קיבלנו את הפנייה שלך — Argo Navis",
  };
  return subjects[source] ?? "קיבלנו את ההודעה שלך — Argo Navis";
}

function sourceLabelHe(source: string): string {
  const labels: Record<string, string> = {
    "landing-he":     "שיחת אבחון לעסק שלך",
    "websites-he":    "אתר חדש",
    "automations-he": "אוטומציה עסקית",
    "systems-he":     "מערכת חדשה",
    "ai-agents-he":   "כלי AI",
    "lp-spreadsheets-he":           "לצאת מהגיליונות האלקטרוניים",
    "systems-fuel-distribution-he": "מערכת מותאמת אישית לעסק שלך",
    "lp-ai-agents-he":              "האם AI מתאים לעסק שלך",
    "lp-connected-systems-he":      "לחבר בין המערכות שלך",
    "lp-missed-calls-he":           "לא לפספס עוד שיחה",
    "automations-travel-agency-he": "מערכת מותאמת אישית לעסק שלך",
    "systems-marketing-agency-he":  "מערכת מותאמת אישית לעסק שלך",
    "automations-reception-he":     "מערכת מותאמת אישית לעסק שלך",
    "lp-order-he":                  "לעשות סדר בעסק",
    "lp-tried-before-he":           "מערכת שמתאימה לעסק שלך",
    "lp-stop-the-leaks-he":         "לסגור את הסדקים בעסק",
    "lp-runs-itself-he":            "אוטומציה לעסק שלך",
  };
  return labels[source] ?? "משהו מעולה";
}

function contactMethodNoteHe(method: string, details: string | null): string {
  if (method === "email") {
    return "נחזור אליכם ישירות לכתובת המייל הזו.";
  }
  const channelNames: Record<string, string> = {
    whatsapp: "ווטסאפ",
    telegram: "טלגרם",
    phone:    "טלפון",
  };
  const channel = channelNames[method] ?? method;
  return details
    ? `ניצור קשר דרך ${channel} במספר/שם המשתמש <strong>${details}</strong>.`
    : `ניצור קשר דרך ${channel}.`;
}

function buildLeadReplyHtmlHe(p: LeadReplyParams): string {
  const { name, message, source, website, preferredContactMethod, normalizedContactDetails } = p;
  const escapedMessage = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const websiteNote = website
    ? `<p style="margin:0 0 12px;">נסתכל על האתר שלכם <a href="${website}" style="color:#4f8ef7;">${website}</a> לפני שנחזור אליכם.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:28px 32px;text-align:right;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Argo Navis</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">ניווט לעסק המודרני</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 32px 24px;text-align:right;">
            <p style="margin:0 0 20px;font-size:16px;color:#1e293b;">שלום <strong>${name}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
              תודה שפנית. קיבלנו את הפנייה שלך בנושא <strong>${sourceLabelHe(source)}</strong> ואנחנו על זה.
            </p>

            <!-- Message echo -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-right:3px solid #e2e8f0;padding:12px 16px;background:#f8fafc;border-radius:4px 0 0 4px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">ההודעה שלך</p>
                  <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;white-space:pre-wrap;">${escapedMessage}</p>
                </td>
              </tr>
            </table>

            ${websiteNote}
            <p style="margin:0 0 12px;font-size:14px;color:#475569;">${contactMethodNoteHe(preferredContactMethod, normalizedContactDetails)}</p>
            <p style="margin:0 0 28px;font-size:14px;color:#475569;">נחזור אליכם תוך <strong>24 שעות</strong> בימי עסקים.</p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">

            <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
              – צוות Argo Navis<br>
              <a href="mailto:hello@argo-navis.net" style="color:#4f8ef7;text-decoration:none;">hello@argo-navis.net</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              קיבלת מייל זה כי שלחת טופס באתר
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
