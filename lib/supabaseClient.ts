import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly at build/runtime instead of silently returning empty data.
  console.warn(
    "Supabase env vars missing. Check .env.local against .env.local.example."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);