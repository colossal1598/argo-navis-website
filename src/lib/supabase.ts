import { createClient } from "@supabase/supabase-js";

/*
  SUPABASE CLIENT — created once and reused across all API routes.

  The two values it needs come from your Supabase project dashboard:
    SUPABASE_URL           → Settings → API → Project URL
    SUPABASE_SERVICE_ROLE_KEY → Settings → API → service_role key
                                (use service_role, NOT anon, for server-side inserts)

  These are stored in a .env file at the project root (never commit that file).
  The .env.example file shows what keys are needed without the real values.
*/

const supabaseUrl  = import.meta.env.SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;

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
