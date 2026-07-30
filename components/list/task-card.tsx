"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarPlus, GripVertical, Star, Trash2 } from "lucide-react";
import { memo, useCallback, useState } from "react";

import { TaskMetaChips } from "@/components/shared/task-meta-chips";
import { ItemMenu } from "@/components/ui/item-menu";
import { safeColor } from "@/lib/colors";
import { useClickOrDouble } from "@/lib/hooks/use-click-or-double";
import type { MenuItem } from "@/components/ui/item-menu";
import type { DayISO } from "@/lib/time";
import type { Project, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * La riga di un task in Lista. Deve dire tutto senza essere aperta: colore del
 * progetto, scadenza col semaforo, energia, stima, sottotask fatti, rinvii.
 *
 * Sul titolo, **clic singolo apre la scheda e doppio clic rinomina**. La
 * distinzione è tutta in `useClickOrDouble`: senza quell'attesa il primo dei
 * due clic aprirebbe sempre la scheda e la rinomina sarebbe irraggiungibile.
 */
export const TaskCard = memo(function TaskCard({
  task,
  project,
  today,
  selected,
  selectionActive,
  menuItems,
  onOpen,
  onRename,
  onToggleDone,
  onToggleSelect,
  onToggleHighlight,
  onSchedule,
  onDelete,
}: {
  task: Task;
  project: Project | undefined;
  today: DayISO;
  selected: boolean;
  selectionActive: boolean;
  menuItems: MenuItem[];
  onOpen: (task: Task) => void;
  onRename: (id: string, title: string) => void;
  onToggleDone: (task: Task) => void;
  onToggleSelect: (id: string) => void;
  onToggleHighlight: (task: Task) => void;
  onSchedule: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const [editing, setEditing] = useState(false);
  const done = task.status === "done";

  // Trascinabile fin da qui, così un task può finire direttamente su uno slot
  // del calendario. L'id è quello della riga, mai l'indice dell'array:
  // altrimenti cambiare ordinamento o filtro romperebbe il trascinamento.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { kind: "task", task },
  });

  const openSheet = useCallback(() => {
    if (selectionActive) onToggleSelect(task.id);
    else onOpen(task);
  }, [onOpen, onToggleSelect, selectionActive, task]);

  const titleHandlers = useClickOrDouble(
    openSheet,
    useCallback(() => setEditing(true), []),
  );

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "border-b border-line last:border-b-0",
        isDragging && "opacity-40",
      )}
    >
      <ItemMenu
        items={menuItems}
        title={task.title}
        className={cn(
          "flex items-start gap-1 py-1.5 pr-2 transition-colors duration-150 ease-out",
          selected && "bg-accent-soft",
        )}
      >
        <button
          type="button"
          className="icon-btn icon-btn-sm mt-1.5 shrink-0 cursor-grab touch-none text-ink-faint active:cursor-grabbing"
          aria-label={`Trascina «${task.title}» sul calendario`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        {/* La barra del colore del progetto, a filo del bordo sinistro. */}
        <span
          aria-hidden="true"
          className="my-1 w-[3px] shrink-0 self-stretch rounded-full"
          style={{ background: safeColor(project?.color) }}
          title={project?.name}
        />

        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggleDone(task)}
          aria-label={done ? `Riapri «${task.title}»` : `Segna «${task.title}» come fatto`}
          className="mt-2.5 size-5 shrink-0 accent-[var(--accent)]"
        />

        <div className="min-w-0 flex-1 py-1">
          {editing ? (
            <input
              autoFocus
              defaultValue={task.title}
              className="field field-bare w-full text-base"
              aria-label="Rinomina il task"
              onBlur={(event) => {
                const next = event.target.value.trim();
                if (next && next !== task.title) onRename(task.id, next);
                setEditing(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <button
              type="button"
              className={cn(
                "block w-full text-balance text-left text-base leading-snug",
                done && "text-ink-faint line-through",
              )}
              {...titleHandlers}
            >
              {task.is_daily_highlight && (
                <Star
                  className="mr-1 inline size-3.5 -translate-y-px fill-current text-accent"
                  aria-label="Highlight del giorno"
                />
              )}
              {task.title}
            </button>
          )}

          <TaskMetaChips task={task} today={today} className="mt-1.5" />
        </div>

        <div className="flex shrink-0 items-center gap-0.5 pt-1">
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={
              task.is_daily_highlight
                ? "Togli l'highlight del giorno"
                : "Rendi highlight del giorno"
            }
            onClick={() => onToggleHighlight(task)}
          >
            <Star
              className={cn(
                "size-[18px]",
                task.is_daily_highlight && "fill-current text-accent",
              )}
            />
          </button>

          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={`Pianifica «${task.title}»`}
            title="Pianifica"
            onClick={() => onSchedule(task)}
          >
            <CalendarPlus className="size-[18px]" />
          </button>

          <button
            type="button"
            className="icon-btn icon-btn-sm"
            aria-label={`Elimina «${task.title}»`}
            onClick={() => onDelete(task)}
          >
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      </ItemMenu>
    </li>
  );
});
