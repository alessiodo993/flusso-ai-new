"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Client Supabase del browser. È un singleton: più istanze si contendono il
 * refresh del token e finiscono per invalidarsi a vicenda.
 */
export function supabaseBrowser(): SupabaseClient {
  cached ??= createBrowserClient(supabaseUrl(), supabaseAnonKey());
  return cached;
}
