import { createClient } from "@supabase/supabase-js";

/*
  SUPABASE CLIENT — created once and reused across all API routes.

  The two values it needs come from your Supabase project dashboard:
    SUPABASE_URL        → Settings → API → Project URL
    SUPABASE_SECRET_KEY → Settings → API Keys → (new) API Keys tab → Secret key
                          Format: sb_secret_...
                          Use the secret key (NOT the publishable/anon key) for
                          server-side inserts — it bypasses RLS and is safe here
                          because this code only runs inside a Cloudflare Worker.

  These are stored in a .env file at the project root (never commit that file).
  The .env.example file shows what keys are needed without the real values.
*/

const supabaseUrl  = import.meta.env.SUPABASE_URL         as string;
const supabaseKey  = import.meta.env.SUPABASE_SECRET_KEY  as string;

/*
  If the env vars are missing (e.g. someone cloned the repo and forgot
  to create .env), throw a clear error message instead of a cryptic crash.
*/
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in your values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
