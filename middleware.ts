import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Percorsi che richiedono una sessione. */
const PROTECTED = ["/app"];

/**
 * Rotte pubbliche da cui un utente già collegato viene portato in app.
 * `/reset-password` resta fuori di proposito: il link di recupero apre una
 * sessione valida, e chi arriva da lì deve poter cambiare la password.
 */
const REDIRECT_IF_SIGNED_IN = ["/", "/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Senza configurazione non blocchiamo la navigazione: le pagine mostrano
  // da sole l'errore, invece di rimbalzare l'utente su un login inutilizzabile.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Questa chiamata è ciò che rinnova il token: va fatta a ogni richiesta.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && PROTECTED.some((p) => pathname.startsWith(p))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    // Conserviamo la destinazione per tornarci dopo l'accesso.
    if (pathname !== "/app") login.searchParams.set("da", pathname + search);
    return redirectKeepingCookies(login, response);
  }

  if (user && REDIRECT_IF_SIGNED_IN.includes(pathname)) {
    const app = request.nextUrl.clone();
    app.pathname = "/app";
    app.search = "";
    return redirectKeepingCookies(app, response);
  }

  return response;
}

/**
 * Un redirect è una response nuova: senza ricopiare i cookie appena rinnovati
 * la sessione verrebbe persa proprio nel momento in cui viene rinfrescata.
 */
function redirectKeepingCookies(to: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(to);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Tutto tranne asset statici, immagini e le rotte pubbliche: il refresh
     * della sessione non ha senso su un font, e ogni passaggio in più costa
     * latenza. `api/public` è escluso perché lo chiama Google, non il browser:
     * lì non c'è alcun cookie da rinnovare.
     */
    "/((?!api/public|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
