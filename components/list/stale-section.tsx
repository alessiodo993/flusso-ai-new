"use client";

import {
  Archive,
  CalendarCheck,
  ChevronRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { DECAY_DAYS } from "@/lib/calibration";
import {
  useBulkUpdateTasks,
  useDeleteTasks,
  useRestoreTasks,
  useTasks,
} from "@/lib/hooks/use-tasks";
import { undoableToast } from "@/lib/hooks/use-undo";
import { isReviewDay } from "@/lib/rituals";
import { cn } from "@/lib/utils";

/**
 * «In dubbio»: i task che non sono mai finiti sul calendario da tre
 * settimane.
 *
 * Sta in fondo alla Lista e parte richiusa. Non è una lista di cose da fare —
 * è un mucchio di decisioni rimandate, e va guardato quando si è pronti a
 * prenderle, non ogni volta che si apre l'app.
 */
export function StaleSection() {
  const { tasks } = useTasks();
  const bulk = useBulkUpdateTasks();
  const remove = useDeleteTasks();
  const restore = useRestoreTasks();
  const [open, setOpen] = useState(false);

  /*
   * Domenica e lunedì la sezione si annuncia da sé, invece di aspettare che
   * qualcuno pensi ad aprirla. Resta chiusa: l'invito è una riga, non un
   * elenco che si spalanca sotto le mani.
   */
  const reviewDay = isReviewDay();

  const stale = tasks.filter((task) => task.status_review === "stale");
  if (stale.length === 0) return null;

  return (
    <div className="border-t border-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 bg-sunken px-3 py-2.5 text-left"
      >
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-ink-faint transition-transform duration-150 ease-out",
            open && "rotate-90",
          )}
        />
        <span className="text-sm font-medium">In dubbio</span>
        <span className="tnum ml-auto text-xs text-ink-faint">
          {stale.length}
        </span>
      </button>

      {reviewDay && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-start gap-2 border-t border-line px-3 py-2 text-left"
        >
          <CalendarCheck className="mt-0.5 size-4 shrink-0 text-accent" />
          <span className="text-xs leading-relaxed text-ink-soft">
            È il momento buono per una passata: {stale.length}{" "}
            {stale.length === 1 ? "task aspetta" : "task aspettano"} una
            decisione. Ci vogliono due minuti.
          </span>
        </button>
      )}

      {open && (
        <>
          <p className="px-3 py-2 text-xs leading-relaxed text-ink-faint">
            Non li pianifichi da {DECAY_DAYS} giorni. Rimettili in gioco o
            archiviali: lasciarli lì a guardarti costa attenzione ogni volta che
            apri la Lista.
          </p>

          <ul>
            {stale.map((task) => (
              <li
                key={task.id}
                className="flex items-center gap-2 border-t border-line px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                  {task.title}
                </span>

                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={`Rimetti «${task.title}» in Lista`}
                  title="Rimetti in Lista"
                  onClick={() =>
                    bulk.mutate({ ids: [task.id], status_review: "active" })
                  }
                >
                  <RefreshCw className="size-4" />
                </button>

                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={`Archivia «${task.title}»`}
                  title="Archivia"
                  onClick={() =>
                    bulk.mutate({ ids: [task.id], status_review: "archived" })
                  }
                >
                  <Archive className="size-4" />
                </button>

                {/* Archiviare lo mette via, eliminare lo fa sparire: sono due
                    decisioni diverse e vanno entrambe a portata di mano, qui
                    dove si sta facendo pulizia. */}
                <button
                  type="button"
                  className="icon-btn icon-btn-sm"
                  aria-label={`Elimina «${task.title}»`}
                  title="Elimina"
                  onClick={() => {
                    remove.mutate({ ids: [task.id] });
                    undoableToast({
                      message: `«${task.title}» eliminato.`,
                      onUndo: () => restore.mutate({ tasks: [task] }),
                    });
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex justify-end gap-2 border-t border-line px-3 py-2">
            <button
              type="button"
              className="btn btn-ghost h-8"
              onClick={() =>
                bulk.mutate({
                  ids: stale.map((task) => task.id),
                  status_review: "archived",
                })
              }
            >
              Archivia tutti
            </button>
          </div>
        </>
      )}
    </div>
  );
}
