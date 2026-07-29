import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Logo } from "@/components/shell/logo";
import { currentUser } from "@/lib/supabase/server";
import { fmtDayLong, todayISO } from "@/lib/time";

export const metadata: Metadata = {
  title: "La tua giornata",
  robots: { index: false },
};

export default async function AppPage() {
  // Il middleware già protegge /app: questo è il secondo giro di chiave, per
  // le richieste che dovessero sfuggire al matcher.
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16">
      <div className="flex items-center gap-2.5">
        <Logo />
        <span className="font-display text-lg">Flusso</span>
      </div>

      <h1 className="mt-8 font-display text-3xl first-letter:uppercase">
        {fmtDayLong(todayISO())}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        Sei dentro come {user.email}. La shell dell&apos;app arriva al passo 4.
      </p>

      <form action="/auth/signout" method="post" className="mt-8">
        <button type="submit" className="btn btn-soft">
          Esci
        </button>
      </form>
    </div>
  );
}
