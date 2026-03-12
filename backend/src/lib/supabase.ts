import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceKey);

// Service role key bypasses RLS — backend only, never expose to clients.
export const supabaseAdmin = supabaseEnabled
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
