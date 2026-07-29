import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * Client con chiave di servizio: scavalca le RLS.
 *
 * Serve soltanto dove i dati sono per costruzione invisibili all'utente —
 * i token Google cifrati in `google_accounts`, che non hanno alcun GRANT per
 * `authenticated`. In ogni altro caso usa `supabaseServer()`: filtrare a mano
 * per `user_id` è un invito a dimenticarselo.
 */
export function supabaseAdmin() {
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
