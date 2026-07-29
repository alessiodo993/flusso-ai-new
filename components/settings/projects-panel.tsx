"use client";

import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { PROJECT_COLORS, safeColor } from "@/lib/colors";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from "@/lib/hooks/use-projects";
import { undoableToast } from "@/lib/hooks/use-undo";
import { useTasks } from "@/lib/hooks/use-tasks";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * I progetti, con il loro colore.
 *
 * Archiviare invece di eliminare è il gesto normale: un progetto finito ha
 * ancora dei task attaccati, e cancellarlo li lascerebbe orfani. L'eliminazione
 * resta possibile, ma dice prima quanti task tocca.
 */
export function ProjectsPanel() {
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PROJECT_COLORS[0]);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ name: trimmed, color });
    setName("");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="field flex-1"
          placeholder="Nome del progetto"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          aria-label="Nome del nuovo progetto"
        />
        <button
          type="button"
          className="btn btn-primary shrink-0 px-3"
          onClick={add}
          disabled={!name.trim()}
          aria-label="Aggiungi progetto"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <ColorPicker value={color} onChange={setColor} label="Colore del nuovo progetto" />

      <ul className="space-y-1.5">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            taskCount={
              tasks.filter((task) => task.project_id === project.id).length
            }
            onRename={(value) => update.mutate({ id: project.id, name: value })}
            onRecolor={(value) =>
              update.mutate({ id: project.id, color: value })
            }
            onToggleArchive={() =>
              update.mutate({ id: project.id, archived: !project.archived })
            }
            onDelete={() => {
              remove.mutate({ id: project.id });
              undoableToast({
                message: `«${project.name}» eliminato.`,
                onUndo: () =>
                  create.mutate({ name: project.name, color: project.color }),
              });
            }}
          />
        ))}
      </ul>

      {projects.length === 0 && (
        <p className="py-4 text-center text-sm text-ink-soft">
          Nessun progetto. Servono a raggruppare, non a incasellare: bastano
          quelli che useresti davvero.
        </p>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  taskCount,
  onRename,
  onRecolor,
  onToggleArchive,
  onDelete,
}: {
  project: Project;
  taskCount: number;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li
      className={cn(
        "rounded-flusso-md border border-line p-2.5",
        project.archived && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Cambia il colore di ${project.name}`}
          className="size-5 shrink-0 rounded-full border border-line"
          style={{ background: safeColor(project.color) }}
          onClick={() => setOpen((current) => !current)}
        />

        <input
          className="field-bare min-w-0 flex-1 text-sm"
          defaultValue={project.name}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== project.name) onRename(value);
            else event.target.value = project.name;
          }}
          aria-label={`Nome di ${project.name}`}
        />

        <span className="tnum shrink-0 text-xs text-ink-faint">
          {taskCount}
        </span>

        <button
          type="button"
          className="icon-btn size-8 shrink-0"
          aria-label={
            project.archived
              ? `Rimetti in uso ${project.name}`
              : `Archivia ${project.name}`
          }
          onClick={onToggleArchive}
        >
          {project.archived ? (
            <ArchiveRestore className="size-4" />
          ) : (
            <Archive className="size-4" />
          )}
        </button>

        <button
          type="button"
          className="icon-btn size-8 shrink-0"
          aria-label={`Elimina ${project.name}`}
          onClick={() => {
            // I task restano, senza progetto: `on delete set null`. Dirlo
            // prima evita la sorpresa di ritrovarseli sparpagliati.
            const message =
              taskCount > 0
                ? `«${project.name}» ha ${taskCount} task. Eliminandolo restano in Lista senza progetto. Procedo?`
                : `Elimino «${project.name}»?`;
            if (window.confirm(message)) onDelete();
          }}
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {open && (
        <div className="mt-2">
          <ColorPicker
            value={project.color}
            label={`Colore di ${project.name}`}
            onChange={(value) => {
              onRecolor(value);
              setOpen(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

function ColorPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={safeColor(value) === color}
          onClick={() => onChange(color)}
          className={cn(
            "size-7 rounded-full border-2 transition-transform duration-150",
            safeColor(value) === color
              ? "border-ink scale-110"
              : "border-transparent",
          )}
          style={{ background: color }}
        />
      ))}
    </div>
  );
}
