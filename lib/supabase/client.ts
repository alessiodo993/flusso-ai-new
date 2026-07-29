"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export type FlussoClient = SupabaseClient<Database>;

let cached: FlussoClient | null = null;

/**
 * Client Supabase del browser. È un singleton: più istanze si contendono il
 * refresh del token e finiscono per invalidarsi a vicenda.
 */
export function supabaseBrowser(): FlussoClient {
  cached ??= createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
  return cached;
}
