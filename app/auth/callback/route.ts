import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Atterraggio di ogni link che autentica: conferma email, recupero password,
 * ritorno da Google. Scambia il codice PKCE con una sessione e prosegue.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Supabase segnala qui gli errori del provider, prima ancora del codice.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?errore=${encodeURIComponent(providerError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?errore=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}

/** Solo percorsi interni: un `next` assoluto sarebbe un open redirect. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}
