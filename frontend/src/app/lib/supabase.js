import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supbaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Connecting to Supabase URL:", supabaseUrl);

export const supabase = createClient(supabaseUrl, supbaseAnonKey);