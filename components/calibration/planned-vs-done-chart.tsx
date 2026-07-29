"use client";

import type { DayTotals } from "@/lib/calibration";
import { fmtDayNumber, fmtDuration } from "@/lib/time";

/**
 * Pianificato contro eseguito, giorno per giorno.
 *
 * Due barre affiancate e non sovrapposte: sovrapposte nasconderebbero il caso
 * più interessante — quello in cui si è **fatto più** del previsto — che
 * apparirebbe identico a «esattamente quanto previsto».
 *
 * Disegnato a mano in SVG: una libreria di grafici per quattordici coppie di
 * numeri sarebbe più codice di così, e più peso da scaricare.
 */
export function PlannedVsDoneChart({ series }: { series: DayTotals[] }) {
  const max = Math.max(
    60,
    ...series.map((day) => Math.max(day.planned, day.done)),
  );

  return (
    <div>
      <div className="flex items-end gap-1" style={{ height: 132 }}>
        {series.map((day) => (
          <div
            key={day.day}
            className="flex h-full flex-1 flex-col justify-end gap-0.5"
            title={`${day.day}: ${fmtDuration(day.planned)} pianificati, ${fmtDuration(day.done)} eseguiti`}
          >
            <div className="flex h-full items-end gap-px">
              <div
                className="flex-1 rounded-t-[2px] bg-line-strong"
                style={{ height: `${(day.planned / max) * 100}%` }}
              />
              <div
                className="flex-1 rounded-t-[2px] bg-accent"
                style={{ height: `${(day.done / max) * 100}%` }}
              />
            </div>
            <span className="tnum text-center text-[10px] text-ink-faint">
              {fmtDayNumber(day.day)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-sm bg-line-strong"
          />
          Pianificato
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent" />
          Eseguito
        </span>
      </div>
    </div>
  );
}
