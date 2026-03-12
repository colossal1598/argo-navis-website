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
    message text
    source  text   (which page / form type the lead came from)

  The SQL to create it is in the README under "Supabase Setup".
*/
const TABLE = "leads";

/*
  POST handler — called when the ContactForm submits.
  Astro automatically routes POST /api/leads here.
*/
export const POST: APIRoute = async ({ request }) => {
  /*
    Parse the incoming JSON body sent by the form's fetch() call.
    Expected shape: { name, email, message, source }
  */
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { name, website, message, source = "landing" } = body;

  /* ── Basic validation ── */
  if (!name?.trim())    return json({ error: "Name is required." }, 400);
  if (!message?.trim()) return json({ error: "Please tell us what you need." }, 400);

  /* ── Insert into Supabase ── */
  const { error } = await supabase.from(TABLE).insert({
    name:    name.trim(),
    website: website?.trim() || null,  /* optional — null if not provided */
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
