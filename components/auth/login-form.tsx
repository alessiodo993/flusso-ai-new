"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { authErrorMessage } from "@/lib/auth-errors";
import { supabaseBrowser } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("da") ?? "/app";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<null | "email" | "google">(null);
  // Il callback OAuth rimanda qui con ?errore= quando il provider rifiuta.
  const [error, setError] = useState<string | null>(() => {
    const fromCallback = searchParams.get("errore");
    return fromCallback ? authErrorMessage(fromCallback) : null;
  });
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending("email");

    try {
      const supabase = supabaseBrowser();

      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (signUpError) throw signUpError;

        // Con la conferma email attiva Supabase non apre la sessione subito.
        if (!data.session) {
          setNotice(
            "Ti abbiamo mandato un'email di conferma. Aprila per attivare l'account.",
          );
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }

      // `refresh` fa rileggere la sessione al middleware prima della navigazione.
      router.refresh();
      router.replace(next);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(null);
    }
  }

  async function onGoogle() {
    setError(null);
    setPending("google");
    try {
      const supabase = supabaseBrowser();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) throw oauthError;
      // Da qui il browser va su Google: nessun altro stato da gestire.
    } catch (caught) {
      setError(authErrorMessage(caught));
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div>
      <h1 className="font-display text-3xl">
        {mode === "signin" ? "Bentornato" : "Crea il tuo Flusso"}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        {mode === "signin"
          ? "Accedi per riprendere da dove eri."
          : "Bastano un'email e una password."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="label mb-1.5 block">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <label htmlFor="password" className="label">
              Password
            </label>
            {mode === "signin" && (
              <Link
                href="/reset-password"
                className="text-xs text-ink-soft underline underline-offset-2 hover:text-ink"
              >
                Password dimenticata?
              </Link>
            )}
          </div>
          <input
            id="password"
            type="password"
            className="field"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          {mode === "signup" && (
            <p className="mt-1.5 text-xs text-ink-faint">Almeno 8 caratteri.</p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-flusso-sm bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="rounded-flusso-sm bg-accent-soft px-3 py-2 text-sm text-accent"
          >
            {notice}
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {pending === "email" && <Loader2 className="size-4 animate-spin" />}
          {mode === "signin" ? "Accedi" : "Crea account"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        oppure
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        type="button"
        onClick={onGoogle}
        className="btn btn-soft w-full"
        disabled={busy}
      >
        {pending === "google" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <GoogleMark />
        )}
        Continua con Google
      </button>

      <p className="mt-8 text-center text-sm text-ink-soft">
        {mode === "signin" ? "Non hai un account?" : "Hai già un account?"}{" "}
        <button
          type="button"
          className="font-medium text-ink underline underline-offset-2"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
        >
          {mode === "signin" ? "Registrati" : "Accedi"}
        </button>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
