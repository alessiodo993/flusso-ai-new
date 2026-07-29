import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Client Supabase per Server Components e Route Handlers: legge la sessione
 * dai cookie e rispetta le RLS come l'utente collegato.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Nei Server Component i cookie sono di sola lettura: il refresh
          // del token lo fa comunque il middleware a ogni richiesta.
        }
      },
    },
  });
}

/**
 * L'utente della richiesta corrente, verificato contro Supabase.
 * Non usare mai `getSession()` lato server: legge il cookie senza validarlo.
 */
export async function currentUser() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Come `currentUser`, ma solleva: per le route che richiedono l'accesso. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Non autenticato");
  return user;
}
