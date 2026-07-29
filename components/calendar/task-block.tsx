"use client";

import { useDraggable } from "@dnd-kit/core";
import { Check, Play, Star } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";

import { readableInk, safeColor } from "@/lib/colors";
import { fmtMin, snap, SLOT } from "@/lib/time";
import type { Project, Task } from "@/lib/types";
import { cn, clamp, haptic } from "@/lib/utils";

const MIN_MINUTES = 15;
const MAX_MINUTES = 240;

/**
 * Un blocco sul calendario: colore pieno del progetto, testo in contrasto,
 * e le due azioni che servono davvero mentre si guarda la giornata — spuntarlo
 * e avviarlo.
 */
export const TaskBlock = memo(function TaskBlock({
  task,
  project,
  top,
  height,
  left,
  width,
  pxPerMinute,
  onOpen,
  onToggleDone,
  onStartFocus,
  onResize,
}: {
  task: Task;
  project: Project | undefined;
  top: number;
  height: number;
  /** Percentuali: i blocchi sovrapposti si dividono la larghezza. */
  left: number;
  width: number;
  pxPerMinute: number;
  onOpen: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onStartFocus: (task: Task) => void;
  onResize: (task: Task, estMinutes: number) => void;
}) {
  const color = safeColor(project?.color);
  const ink = readableInk(color);
  const done = task.status === "done";

  const [preview, setPreview] = useState<number | null>(null);
  const resizing = useRef<{ startY: number; startMinutes: number } | null>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { kind: "task", task },
    // Ridimensionare non è trascinare: mentre si tira il bordo il blocco non
    // deve staccarsi dalla griglia.
    disabled: preview !== null,
  });

  const minutes = preview ?? task.est_minutes ?? 30;

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      resizing.current = {
        startY: event.clientY,
        startMinutes: task.est_minutes ?? 30,
      };
      setPreview(task.est_minutes ?? 30);
      haptic(10);
    },
    [task.est_minutes],
  );

  const onResizePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = resizing.current;
      if (!state) return;
      const deltaMinutes = (event.clientY - state.startY) / pxPerMinute;
      const next = clamp(
        snap(state.startMinutes + deltaMinutes, SLOT),
        MIN_MINUTES,
        Math.min(MAX_MINUTES, 1440 - (task.start_minute ?? 0)),
      );
      setPreview(next);
    },
    [pxPerMinute, task.start_minute],
  );

  const onResizePointerUp = useCallback(() => {
    const state = resizing.current;
    resizing.current = null;
    const next = preview;
    setPreview(null);
    if (state && next !== null && next !== state.startMinutes) {
      haptic();
      onResize(task, next);
    }
  }, [onResize, preview, task]);

  const shownHeight = preview !== null ? preview * pxPerMinute : height;
  const start = task.start_minute ?? 0;

  return (
    <div
      ref={setNodeRef}
      style={{
        top,
        height: Math.max(shownHeight, 22),
        left: `${left}%`,
        width: `calc(${width}% - 3px)`,
        background: color,
        color: ink,
      }}
      className={cn(
        "absolute overflow-hidden rounded-flusso-sm text-left",
        "touch-none select-none",
        isDragging && "opacity-30",
        done && "opacity-60",
      )}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="block h-full w-full px-1.5 py-1 text-left"
        aria-label={`${task.title}, dalle ${fmtMin(start)} alle ${fmtMin(start + minutes)}`}
      >
        <span
          className={cn(
            "flex items-center gap-1 text-[13px] font-medium leading-tight",
            done && "line-through",
          )}
        >
          {task.is_daily_highlight && (
            <Star className="size-3 shrink-0 fill-current" aria-hidden="true" />
          )}
          <span className="truncate">{task.title}</span>
        </span>

        {shownHeight > 40 && (
          <span className="tnum mt-0.5 block text-[11px] opacity-80">
            {fmtMin(start)}–{fmtMin(start + minutes)}
          </span>
        )}
      </button>

      {/* Le azioni stanno sopra il pulsante di apertura, non dentro: un
          pulsante annidato in un altro non è un elemento valido. */}
      <div className="absolute right-1 top-1 flex items-center gap-0.5">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onStartFocus(task)}
          aria-label={`Avvia il focus su «${task.title}»`}
          className="flex size-6 items-center justify-center rounded-full bg-black/10 backdrop-blur-sm"
        >
          <Play className="size-3 fill-current" />
        </button>

        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onToggleDone(task)}
          aria-label={
            done ? `Riapri «${task.title}»` : `Segna «${task.title}» come fatto`
          }
          aria-pressed={done}
          className={cn(
            "flex size-6 items-center justify-center rounded-full",
            done ? "bg-black/25" : "bg-black/10 backdrop-blur-sm",
          )}
        >
          <Check className="size-3.5" />
        </button>
      </div>

      {/* Maniglia di ridimensionamento: alta abbastanza da essere presa col
          pollice, non solo con un puntatore. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Durata di «${task.title}»`}
        aria-valuemin={MIN_MINUTES}
        aria-valuemax={MAX_MINUTES}
        aria-valuenow={minutes}
        aria-valuetext={`${minutes} minuti`}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? SLOT : -SLOT;
            onResize(task, clamp(minutes + delta, MIN_MINUTES, MAX_MINUTES));
          }
        }}
        className="absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize touch-none items-center justify-center"
      >
        <span
          aria-hidden="true"
          className="h-0.5 w-7 rounded-full bg-current opacity-40"
        />
      </div>
    </div>
  );
});
