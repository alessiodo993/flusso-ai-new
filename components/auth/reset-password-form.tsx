"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authErrorMessage, withTimeout } from "@/lib/auth-errors";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Una sola pagina per due momenti diversi:
 * - senza sessione si chiede il link di recupero;
 * - con sessione (si arriva qui dal link, che autentica) si sceglie la nuova
 *   password. Vale anche per chi è già dentro e vuole cambiarla.
 */
type Stage = "loading" | "request" | "update";

export function ResetPasswordForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setStage(data.user ? "update" : "request");
    });

    // Il link di recupero apre la sessione dopo il primo render: senza questo
    // listener resteremmo sul modulo di richiesta anche da autenticati.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY" || session) setStage("update");
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function requestLink(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = supabaseBrowser();
      const { error: resetError } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        }),
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = supabaseBrowser();
      const { error: updateError } = await withTimeout(
        supabase.auth.updateUser({ password }),
      );
      if (updateError) throw updateError;
      router.refresh();
      router.replace("/app");
    } catch (caught) {
      setError(authErrorMessage(caught));
      setPending(false);
    }
  }

  if (stage === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-faint">
        <Loader2 className="size-4 animate-spin" />
        Un istante…
      </div>
    );
  }

  if (stage === "update") {
    return (
      <div>
        <h1 className="font-display text-3xl">Scegli una nuova password</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Da questo momento userai questa per accedere.
        </p>

        <form onSubmit={updatePassword} className="mt-8 space-y-4">
          <div>
            <label htmlFor="new-password" className="label mb-1.5 block">
              Nuova password
            </label>
            <input
              id="new-password"
              type="password"
              className="field"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
            <p className="mt-1.5 text-xs text-ink-faint">Almeno 8 caratteri.</p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-flusso-sm bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salva ed entra
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl">Password dimenticata</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Ti mandiamo un link per sceglierne una nuova.
      </p>

      {sent ? (
        <p
          role="status"
          className="mt-8 rounded-flusso-sm bg-accent-soft px-3 py-2.5 text-sm text-accent"
        >
          Se esiste un account con questa email, il link è appena partito.
          Controlla la posta.
        </p>
      ) : (
        <form onSubmit={requestLink} className="mt-8 space-y-4">
          <div>
            <label htmlFor="reset-email" className="label mb-1.5 block">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              className="field"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-flusso-sm bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={pending}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Mandami il link
          </button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-ink-soft">
        <Link href="/login" className="underline underline-offset-2">
          Torna all&apos;accesso
        </Link>
      </p>
    </div>
  );
}
