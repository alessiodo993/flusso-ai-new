import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Flusso — dal pensiero al blocco di calendario",
  description:
    "Cattura un pensiero in tre secondi, trasformalo in un blocco pianificato e a fine giornata scopri quanto hai davvero eseguito.",
  openGraph: {
    title: "Flusso — dal pensiero al blocco di calendario",
    description:
      "Cattura un pensiero in tre secondi, trasformalo in un blocco pianificato e a fine giornata scopri quanto hai davvero eseguito.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-16">
      <h1 className="text-balance font-display text-4xl leading-[1.1] sm:text-6xl">
        Se non è sul calendario,
        <br />
        non succede.
      </h1>

      <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-ink-soft sm:text-lg">
        Flusso non è una lista di cose da fare. È un sistema di deep work:
        cattura, triage, pianifica, esegui, calibra. Collega gli obiettivi del
        trimestre ai blocchi che esegui davvero, e usa i tuoi dati per rendere
        realistico il piano di domani.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href="/login" className="btn btn-primary px-5">
          Inizia
        </Link>
        <span className="text-sm text-ink-faint">
          Un solo highlight al giorno. Il resto è rumore.
        </span>
      </div>

      <dl className="mt-16 grid gap-px overflow-hidden rounded-flusso border border-line bg-line sm:grid-cols-3">
        {[
          {
            term: "Cattura",
            detail: "Un pensiero in meno di tre secondi, senza campi da riempire.",
          },
          {
            term: "Pianifica",
            detail: "Blocchi reali sul calendario, con i buffer già previsti.",
          },
          {
            term: "Calibra",
            detail: "Quanto avevi previsto, quanto hai eseguito davvero.",
          },
        ].map((item) => (
          <div key={item.term} className="bg-surface p-5">
            <dt className="font-display text-lg">{item.term}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {item.detail}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
