"use client";

import { AlertTriangle, Check, TrendingUp } from "lucide-react";

import type { Rhythm } from "@/lib/quarter";
import { cn } from "@/lib/utils";

/**
 * Tempo trascorso contro avanzamento reale.
 *
 * È la sola informazione che rende utile un OKR a metà trimestre: senza il
 * confronto, «al 30%» non dice se sei in ritardo o in anticipo — e sono due
 * situazioni opposte.
 */
export function RhythmDashboard({
  rhythm,
  daysLeft,
}: {
  rhythm: Rhythm;
  daysLeft: number;
}) {
  const Icon =
    rhythm.status === "indietro"
      ? AlertTriangle
      : rhythm.status === "avanti"
        ? TrendingUp
        : Check;

  return (
    <div
      className={cn(
        "panel p-4",
        rhythm.status === "indietro" && "border-warn/40 bg-warn-soft",
      )}
    >
      <div className="flex items-start gap-2">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            rhythm.status === "indietro" ? "text-warn" : "text-accent",
          )}
          aria-hidden="true"
        />
        <p className="text-pretty text-sm leading-relaxed">{rhythm.message}</p>
      </div>

      {/* Due barre sovrapposte: il trimestre sotto, i risultati sopra. Lo
          scarto fra le due estremità è il ritardo, e si vede senza leggere. */}
      <div className="mt-3">
        <div className="relative h-2 overflow-hidden rounded-full bg-sunken">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-line-strong"
            style={{ width: `${rhythm.elapsed * 100}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            style={{ width: `${rhythm.progress * 100}%` }}
          />
        </div>

        <div className="mt-2 flex items-center gap-4 text-xs text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm bg-line-strong"
            />
            Trimestre
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent" />
            Risultati
          </span>
          {daysLeft > 0 && (
            <span className="tnum ml-auto">{daysLeft} giorni</span>
          )}
        </div>
      </div>
    </div>
  );
}
