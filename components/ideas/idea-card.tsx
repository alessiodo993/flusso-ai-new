"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, GripVertical, Trash2 } from "lucide-react";
import { memo, useState } from "react";

import { ItemMenu, type MenuItem } from "@/components/ui/item-menu";
import { safeColor } from "@/lib/colors";
import type { Idea, Project } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Una riga di Idee. Il trascinamento passa **solo** dalla maniglia dedicata:
 * su touch un'area di presa più larga renderebbe impossibile scorrere la
 * lista, e la maniglia è anche il modo per portare l'idea sul calendario.
 */
export const IdeaCard = memo(function IdeaCard({
  idea,
  project,
  selected,
  selectionActive,
  onToggleSelect,
  onRename,
  onPromote,
  onDelete,
}: {
  idea: Idea;
  project: Project | undefined;
  selected: boolean;
  selectionActive: boolean;
  onToggleSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onPromote: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: idea.id, data: { kind: "idea", idea } });

  const menuItems: MenuItem[] = [
    {
      id: "promote",
      label: "Promuovi a Lista",
      Icon: ArrowRight,
      onSelect: () => onPromote(idea),
    },
    { id: "rename", label: "Rinomina", onSelect: () => setEditing(true) },
    {
      id: "select",
      label: selected ? "Togli dalla selezione" : "Seleziona",
      onSelect: () => onToggleSelect(idea.id),
    },
    {
      id: "delete",
      label: "Elimina",
      Icon: Trash2,
      tone: "danger",
      separatorBefore: true,
      onSelect: () => onDelete(idea),
    },
  ];

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "border-b border-line last:border-b-0",
        isDragging && "opacity-40",
      )}
    >
      <ItemMenu
        items={menuItems}
        title={idea.title}
        className={cn(
          "flex items-center gap-1 pr-2 transition-colors duration-150 ease-out",
          selected && "bg-accent-soft",
        )}
      >
        <button
          type="button"
          className="icon-btn size-11 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          aria-label={`Trascina «${idea.title}»`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ background: safeColor(project?.color) }}
          title={project?.name}
        />

        {editing ? (
          <input
            autoFocus
            defaultValue={idea.title}
            className="field field-bare ml-1 min-h-11 flex-1 text-base"
            aria-label="Rinomina l'idea"
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next && next !== idea.title) onRename(idea.id, next);
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
            className="ml-1 min-h-11 flex-1 truncate py-2 text-left text-base"
            onDoubleClick={() => setEditing(true)}
            onClick={(event) => {
              // Con una selezione già aperta il tocco continua a selezionare:
              // altrimenti servirebbe una modalità da attivare a parte.
              if (selectionActive || event.metaKey || event.ctrlKey) {
                onToggleSelect(idea.id);
              }
            }}
          >
            {idea.title}
          </button>
        )}

        <button
          type="button"
          className="icon-btn shrink-0"
          aria-label={`Promuovi «${idea.title}» a Lista`}
          title="Promuovi a Lista"
          onClick={() => onPromote(idea)}
        >
          <ArrowRight className="size-4" />
        </button>
      </ItemMenu>
    </li>
  );
});
