"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical, Plus, X } from "lucide-react";
import { useRef, useState } from "react";

import { deadlineTone, fmtRelativeDay, todayISO } from "@/lib/time";
import type { Subtask } from "@/lib/types";
import { cn, haptic, uid } from "@/lib/utils";

/**
 * I sottotask di un task: riordinabili, spuntabili e con una scadenza propria,
 * perché un pezzo può dover arrivare prima dell'insieme.
 */
export function SubtaskList({
  subtasks,
  onChange,
}: {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayISO();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 6 },
    }),
  );

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...subtasks, { id: uid(), text, done: false, deadline: null }]);
    setDraft("");
    inputRef.current?.focus();
  }

  function patch(id: string, changes: Partial<Subtask>) {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = subtasks.findIndex((s) => s.id === active.id);
    const to = subtasks.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    haptic();
    onChange(arrayMove(subtasks, from, to));
  }

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={subtasks.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul>
            {subtasks.map((subtask) => (
              <SubtaskRow
                key={subtask.id}
                subtask={subtask}
                today={today}
                onToggle={() => patch(subtask.id, { done: !subtask.done })}
                onText={(text) => patch(subtask.id, { text })}
                onDeadline={(deadline) => patch(subtask.id, { deadline })}
                onRemove={() =>
                  onChange(subtasks.filter((s) => s.id !== subtask.id))
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="mt-1 flex items-center gap-1.5">
        <input
          ref={inputRef}
          className="field field-bare min-h-10 flex-1 text-sm"
          placeholder="Aggiungi un passo…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          aria-label="Nuovo sottotask"
        />
        <button
          type="button"
          className="icon-btn icon-btn-sm shrink-0"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Aggiungi il sottotask"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

function SubtaskRow({
  subtask,
  today,
  onToggle,
  onText,
  onDeadline,
  onRemove,
}: {
  subtask: Subtask;
  today: string;
  onToggle: () => void;
  onText: (text: string) => void;
  onDeadline: (deadline: string | null) => void;
  onRemove: () => void;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id });

  const tone = subtask.deadline ? deadlineTone(subtask.deadline, today) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex items-center gap-1", isDragging && "opacity-40")}
    >
      <button
        type="button"
        className="icon-btn icon-btn-sm shrink-0 cursor-grab touch-none text-ink-faint active:cursor-grabbing"
        aria-label={`Sposta «${subtask.text}»`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>

      <input
        type="checkbox"
        checked={subtask.done}
        onChange={onToggle}
        aria-label={subtask.text}
        className="size-4 shrink-0 accent-[var(--accent)]"
      />

      <input
        value={subtask.text}
        onChange={(event) => onText(event.target.value)}
        aria-label="Testo del sottotask"
        className={cn(
          "field field-bare min-h-9 flex-1 text-sm",
          subtask.done && "text-ink-faint line-through",
        )}
      />

      <button
        type="button"
        className={cn(
          "chip shrink-0 cursor-pointer",
          tone === "overdue" && "chip-danger",
          tone === "soon" && "chip-warn",
          !subtask.deadline && "text-ink-faint",
        )}
        onClick={() => {
          dateRef.current?.showPicker?.();
          dateRef.current?.focus();
        }}
        aria-label={
          subtask.deadline
            ? `Scadenza del sottotask: ${subtask.deadline}`
            : "Aggiungi una scadenza al sottotask"
        }
      >
        <CalendarClock className="size-3" aria-hidden="true" />
        {subtask.deadline ? fmtRelativeDay(subtask.deadline, today) : ""}
      </button>

      {/* Il campo nativo resta invisibile: serve solo ad aprire il calendario. */}
      <input
        ref={dateRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        value={subtask.deadline ?? ""}
        onChange={(event) => onDeadline(event.target.value || null)}
      />

      <button
        type="button"
        className="icon-btn icon-btn-sm shrink-0"
        onClick={onRemove}
        aria-label={`Togli «${subtask.text}»`}
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}
