"use client";

import { useCallback, useMemo } from "react";

import { useBlocks } from "@/lib/hooks/use-blocks";
import { useCalibration } from "@/lib/hooks/use-calibration";
import { useGoogleEvents } from "@/lib/hooks/use-google";
import { useOkrs, currentQuarter } from "@/lib/hooks/use-okrs";
import { useSettings } from "@/lib/hooks/use-settings";
import { useTasks } from "@/lib/hooks/use-tasks";
import {
  availableGaps,
  timeToMinutes,
  type DayContext,
  type PlannerSettings,
} from "@/lib/planner";
import { quarterProgress } from "@/lib/quarter";
import { type DayISO } from "@/lib/time";
import { isScheduled, keyResultProgress } from "@/lib/types";

/**
 * Tutto ciò che il solver deve sapere sui giorni, preso dalla cache che
 * l'app ha già in mano.
 *
 * Il calcolo sta sul client di proposito: il calendario è già qui, con i
 * blocchi fissi e gli eventi Google appena sincronizzati. Rifarlo sul server
 * significherebbe rileggere le stesse righe per ottenere gli stessi numeri,
 * con in più la possibilità di ottenerne di diversi.
 */
export function usePlannerContext() {
  const { settings } = useSettings();
  const { byDay } = useTasks();
  const { forDay } = useBlocks();
  const { byDay: googleByDay } = useGoogleEvents();
  const { coefficient } = useCalibration();
  const { okrs } = useOkrs(currentQuarter());

  const plannerSettings = useMemo<PlannerSettings>(
    () => ({
      workStart: settings.work_start,
      workEnd: settings.work_end,
      bufferMinutes: settings.buffer_minutes,
      dailyCapMinutes: settings.daily_cap_minutes,
      peakStart: timeToMinutes(settings.peak_hours_start),
      peakEnd: timeToMinutes(settings.peak_hours_end),
      lowStart: timeToMinutes(settings.low_hours_start),
      lowEnd: timeToMinutes(settings.low_hours_end),
    }),
    [settings],
  );

  /**
   * Gli impegni di un giorno. Gli eventi Google contano come i blocchi fissi:
   * la specifica li chiama «ostacoli invalicabili», e un pranzo di lavoro non
   * diventa disponibile solo perché è stato scritto altrove.
   */
  const contextsFor = useCallback(
    (days: DayISO[]): DayContext[] =>
      days.map((day) => {
        const scheduled = (byDay.get(day) ?? []).filter(isScheduled);
        const busy = [
          ...scheduled.map((task) => ({
            start: task.start_minute,
            end: task.start_minute + task.est_minutes,
          })),
          ...forDay(day).map((block) => ({
            start: block.start_minute,
            end: block.end_minute,
          })),
          ...(googleByDay.get(day) ?? [])
            .filter((event) => !event.all_day)
            .map((event) => ({
              start: event.start_minute,
              end: event.end_minute,
            })),
        ];

        return {
          day,
          busy,
          // Solo i task erodono il tetto: è un limite a quanto ci si carica
          // addosso, non a quanto è pieno il calendario.
          usedMinutes: scheduled.reduce(
            (total, task) => total + task.est_minutes,
            0,
          ),
        };
      }),
    [byDay, forDay, googleByDay],
  );

  /** Quanto spazio resta davvero in quei giorni: serve al prompt. */
  const minutesAvailable = useCallback(
    (days: DayISO[]) => {
      const window = {
        start: plannerSettings.workStart,
        end: plannerSettings.workEnd,
      };

      return contextsFor(days).reduce((total, context) => {
        const free = availableGaps(
          window,
          context.busy,
          plannerSettings.bufferMinutes,
        ).reduce((sum, gap) => sum + (gap.end - gap.start), 0);

        const left = Math.max(
          0,
          plannerSettings.dailyCapMinutes - context.usedMinutes,
        );
        return total + Math.min(free, left);
      }, 0);
    },
    [contextsFor, plannerSettings],
  );

  /**
   * I progetti legati a un risultato chiave rimasto indietro rispetto al
   * trimestre: sono quelli che meritano una spinta nella scelta.
   */
  const behindProjects = useMemo(() => {
    const elapsed = quarterProgress(currentQuarter());
    const ids = new Set<string>();

    for (const okr of okrs) {
      if (!okr.project_id) continue;
      const behind = okr.key_results.some(
        (kr) => keyResultProgress(kr) < elapsed - 0.1,
      );
      if (behind) ids.add(okr.project_id);
    }
    return ids;
  }, [okrs]);

  return {
    settings: plannerSettings,
    coefficient,
    contextsFor,
    minutesAvailable,
    behindProjects,
  };
}
