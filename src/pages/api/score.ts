import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

/*
  SMB Visibility Score — quiz-lead endpoint.
  Receives finished quiz submissions (name/email + answers + the score and
  band the client computed) from the score tool pages and forwards them as
  JSON to an n8n webhook. Nothing is stored here — n8n owns the follow-up.
  SCORE_WEBHOOK_URL is set in Cloudflare Pages settings (and .dev.vars for
  local dev) — never in wrangler.jsonc, never committed.
*/
export const prerender = false;

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/* Allowed enum values — anything else is a malformed/forged submission. */
const BANDS   = new Set(["clear", "foggy", "blind"]);
const LOCALES = new Set(["en", "he"]);
const SOURCES = new Set(["score-en", "score-he"]);
/* q1 option keys exactly as both score pages render them (stable English keys). */
const Q1_KEYS = new Set(["accounting-software", "sheets-only", "mixed-tools", "paper-or-head"]);

/* Answer shape the quiz sends: q1 is a free-pick string key, q2–q5 are the
   numeric option scores. We validate types only — the score itself is
   client-computed and merely range-checked, not recomputed. */
const NUMERIC_ANSWER_KEYS = ["q2", "q3", "q4", "q5"] as const;

/*
  POST handler — called when the score tool submits.
  Astro automatically routes POST /api/score here.
*/
export const POST: APIRoute = async ({ request }) => {
  /*
    Parse the incoming JSON body sent by the tool's fetch() call.
    Expected shape: { name, email, answers, score, band, locale, source }
    plus an optional "cf-turnstile-response" token.
  */
  let body: Record<string, unknown>;
  try {
    /* request.json() happily parses null / "string" / 5 too — destructuring
       those would TypeError into an HTML 500, so reject non-object bodies. */
    const parsed: unknown = await request.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return json({ error: "Invalid request body." }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { name, email, answers, score, band, locale, source } = body;
  const turnstileToken = typeof body["cf-turnstile-response"] === "string" ? body["cf-turnstile-response"] : undefined;
  const turnstileSecret = env.TURNSTILE_SECRET_KEY;
  const isProd = import.meta.env.PROD;
  const hebrew = locale === "he";
  /* Bilingual error string — `en`/`he` pair, picked by the submission's locale. */
  const t = (en: string, he: string) => (hebrew ? he : en);

  /*
    Same Turnstile stance as api/leads.ts: verification only runs (and is
    only required) when both the secret AND the public site key are
    configured. Missing config degrades to "no bot check" instead of
    blocking every lead — a missed Cloudflare Pages env var must never
    kill submissions site-wide.
  */
  if (isProd && !turnstileSecret) {
    console.error("TURNSTILE_SECRET_KEY is missing in production — bot-check is disabled until it's configured.");
  }

  const turnstileWidgetConfigured = Boolean(import.meta.env.PUBLIC_TURNSTILE_SITE_KEY);

  if (isProd && turnstileSecret && turnstileWidgetConfigured && !turnstileToken) {
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

  /* ── Strict validation — reject anything the quiz pages don't send ── */
  if (typeof name !== "string" || !name.trim()) {
    return json({ error: t("Name is required.", "יש להזין שם.") }, 400);
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return json({ error: t("Name is too long.", "השם ארוך מדי.") }, 400);
  }

  if (typeof email !== "string" || !email.trim()) {
    return json({ error: t("Email is required.", "יש להזין כתובת אימייל.") }, 400);
  }
  const emailValue = email.trim();
  if (emailValue.length > 200) {
    return json({ error: t("Email is too long.", "כתובת האימייל ארוכה מדי.") }, 400);
  }
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  if (!emailValid) {
    return json({ error: t("Please enter a valid email.", "יש להזין כתובת אימייל תקינה.") }, 400);
  }

  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return json({ error: t("Invalid quiz answers.", "תשובות השאלון אינן תקינות.") }, 400);
  }
  const answerRecord = answers as Record<string, unknown>;
  const q1Valid = typeof answerRecord.q1 === "string" && Q1_KEYS.has(answerRecord.q1);
  const numericValid = NUMERIC_ANSWER_KEYS.every(
    (key) => typeof answerRecord[key] === "number" && Number.isFinite(answerRecord[key]),
  );
  if (!q1Valid || !numericValid) {
    return json({ error: t("Invalid quiz answers.", "תשובות השאלון אינן תקינות.") }, 400);
  }

  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
    return json({ error: t("Invalid score.", "תוצאה לא תקינה.") }, 400);
  }

  if (typeof band !== "string" || !BANDS.has(band)) {
    return json({ error: t("Invalid result band.", "טווח תוצאה לא תקין.") }, 400);
  }
  if (typeof locale !== "string" || !LOCALES.has(locale)) {
    return json({ error: "Invalid locale." }, 400);
  }
  if (typeof source !== "string" || !SOURCES.has(source)) {
    return json({ error: t("Invalid source.", "מקור לא תקין.") }, 400);
  }

  /*
    ── Forward to n8n ──
    When SCORE_WEBHOOK_URL is unset (local dev / preview deploys) we skip
    the forward but still answer 200 — the tool must keep working without
    the integration. The warn keeps it visible in Worker logs.
  */
  const webhookUrl = env.SCORE_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("SCORE_WEBHOOK_URL is not set — skipping webhook forward for this score lead.");
    return json({ ok: true }, 200);
  }

  /*
    Built field-by-field on purpose — never spread the raw body or the raw
    answers object, or unvalidated junk keys forward to n8n verbatim.
  */
  const payload = {
    name: trimmedName,
    email: emailValue,
    answers: {
      q1: answerRecord.q1,
      q2: answerRecord.q2,
      q3: answerRecord.q3,
      q4: answerRecord.q4,
      q5: answerRecord.q5,
    },
    score,
    band,
    locale,
    source,
    submitted_at: new Date().toISOString(),
  };

  /*
    A failed forward is a lost lead — never swallow it. Non-2xx or a
    network error returns 502 so the client can show its retry message.
  */
  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!webhookRes.ok) {
      console.error(`Score webhook responded ${webhookRes.status}`);
      return json({ error: t("Could not save your result. Please try again.", "לא הצלחנו לשמור את התוצאה. נסו שוב.") }, 502);
    }
  } catch (webhookError) {
    console.error("Score webhook fetch failed:", webhookError);
    return json({ error: t("Could not save your result. Please try again.", "לא הצלחנו לשמור את התוצאה. נסו שוב.") }, 502);
  }

  return json({ ok: true }, 200);
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
