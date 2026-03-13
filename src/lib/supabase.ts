import { createClient } from "@supabase/supabase-js";

/*
  SUPABASE CLIENT — factory function called per-request from the API route.

  The two values it needs come from your Supabase project dashboard:
    SUPABASE_URL        → Settings → API → Project URL
    SUPABASE_SECRET_KEY → Settings → API Keys → (new) API Keys tab → Secret key
                          Format: sb_secret_...
                          Use the secret key (NOT the publishable/anon key) for
                          server-side inserts — it bypasses RLS and is safe here
                          because this code only runs inside a Cloudflare Worker.

  These are stored in a .env file at the project root (never commit that file).
  The .env.example file shows what keys are needed without the real values.

  NOTE: We use a factory function rather than a module-level singleton so that
  Cloudflare runtime env bindings (import.meta.env) are read at request time,
  not at Worker initialisation time when they may not yet be injected.
*/
export function createSupabaseClient(supabaseUrl: string, supabaseKey: string) {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase env vars. Copy .env.example to .env and fill in your values."
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}