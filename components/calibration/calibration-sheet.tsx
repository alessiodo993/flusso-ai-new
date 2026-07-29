"use client";

import { RotateCcw, TrendingUp } from "lucide-react";
import { useCallback, useState } from "react";

import { PlannedVsDoneChart } from "@/components/calibration/planned-vs-done-chart";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { MIN_SESSIONS } from "@/lib/calibration";
import { useFlussoEvent } from "@/lib/events";
import { useCalibration, usePostponeRanking } from "@/lib/hooks/use-calibration";
import { useTasks } from "@/lib/hooks/use-tasks";
import { cn } from "@/lib/utils";

/**
 * «Realtà vs Piano»: quanto avevi previsto, quanto hai davvero eseguito.
 *
 * Non è una pagella. Serve a una cosa sola — far sì che la prossima
 * pianificazione parta dai tuoi numeri veri invece che dai tuoi buoni
 * propositi.
 */
export function CalibrationSheet() {
  const [open, setOpen] = useState(false);
  const { tasks } = useTasks();
  const calibration = useCalibration();
  const ranking = usePostponeRanking(tasks);

  useFlussoEvent(
    "flusso:open-calibration",
    useCallback(() => setOpen(true), []),
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Realtà vs Piano"
      description="Come vanno davvero le tue giornate."
    >
      <div className="space-y-6 pb-3">
        <section>
          <p className="label mb-2">Stime</p>

          {calibration.coefficient === null ? (
            <p className="rounded-flusso-sm bg-sunken p-3 text-sm leading-relaxed text-ink-soft">
              Servono almeno {MIN_SESSIONS} sessioni di focus concluse prima di
              poter dire qualcosa di sensato. Finora ne hai{" "}
              <span className="tnum">{calibration.sessionCount}</span>.
            </p>
          ) : (
            <div className="panel-soft p-4">
              <p className="flex items-baseline gap-2">
                <span className="tnum font-display text-3xl">
                  ×{calibration.coefficient.toFixed(2)}
                </span>
                <span className="text-sm text-ink-soft">
                  il tempo che serve davvero
                </span>
              </p>

              {calibration.message && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-warn">
                  <TrendingUp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {calibration.message} Il pianificatore ne tiene conto da
                    solo: una stima di 60 minuti diventa{" "}
                    <strong>
                      {Math.round((60 * calibration.coefficient) / 5) * 5} minuti
                    </strong>{" "}
                    quando cerca lo slot.
                  </span>
                </p>
              )}
            </div>
          )}
        </section>

        <section>
          <p className="label mb-2">Blocchi completati</p>
          {calibration.completion.rate === null ? (
            <p className="text-sm text-ink-soft">
              Nessun blocco pianificato nelle ultime due settimane.
            </p>
          ) : (
            <p className="flex items-baseline gap-2">
              <span className="tnum font-display text-3xl">
                {Math.round(calibration.completion.rate * 100)}%
              </span>
              <span className="text-sm text-ink-soft">
                {calibration.completion.done} su{" "}
                {calibration.completion.planned} negli ultimi 14 giorni
              </span>
            </p>
          )}
        </section>

        {/*
          La metrica che dice se la settimana è andata. Sta **sopra** il
          grafico di proposito: dodici cose piccole non fanno una settimana
          riuscita se quella che contava è slittata tutti i giorni.
        */}
        <section>
          <p className="label mb-2">Highlight completati</p>
          <p className="flex items-baseline gap-2">
            <span className="tnum font-display text-3xl">
              {calibration.highlights.done}
              <span className="text-xl text-ink-faint">
                /{calibration.highlights.days}
              </span>
            </span>
            <span className="text-sm text-ink-soft">
              {calibration.highlights.chosen === 0
                ? "questa settimana non hai ancora scelto una cosa che conta"
                : calibration.highlights.done === calibration.highlights.chosen
                  ? "giornate vinte, su quelle in cui hai scelto"
                  : `su ${calibration.highlights.chosen} scelti questa settimana`}
            </span>
          </p>
        </section>

        <section>
          <p className="label mb-2">Pianificato contro eseguito</p>
          <PlannedVsDoneChart series={calibration.series} />
        </section>

        {ranking.length > 0 && (
          <section>
            <p className="label mb-2">Quelli che continui a spostare</p>
            <ul className="space-y-1">
              {ranking.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2 rounded-flusso-sm bg-sunken px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <span
                    className={cn(
                      "chip tnum shrink-0",
                      task.postpone_count >= 3 && "chip-danger",
                    )}
                  >
                    <RotateCcw className="size-3" aria-hidden="true" />
                    {task.postpone_count}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">
              Un task rinviato più volte di solito non ha bisogno di un altro
              giorno: ha bisogno di essere spezzato, ridotto, o lasciato andare.
            </p>
          </section>
        )}
      </div>
    </ResponsiveSheet>
  );
}
