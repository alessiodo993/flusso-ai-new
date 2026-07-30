"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ColorPicker } from "@/components/projects/color-picker";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { nextDistinctColor } from "@/lib/colors";
import { useFlussoEvent } from "@/lib/events";
import { useCreateProject, useProjects } from "@/lib/hooks/use-projects";
import { useUpdateTask } from "@/lib/hooks/use-tasks";

/**
 * Creare un progetto senza passare dalle Impostazioni.
 *
 * Il momento in cui serve un progetto non è mentre si configura l'app: è
 * mentre si archivia un task e ci si accorge che non appartiene a nessuno dei
 * progetti esistenti. Costringere a uscire, aprire le Impostazioni, creare,
 * tornare indietro e ritrovare il task significa che il progetto non lo si
 * crea — e i task restano tutti in «Senza progetto».
 *
 * Un solo host, montato nella shell: chiunque serva apre passando per
 * `flusso:new-project`, e chi lo apre da un task riceve il progetto già
 * assegnato senza doverlo ricollegare a mano.
 */
export function ProjectCreateDialog() {
  const { active } = useProjects();
  const create = useCreateProject();
  const updateTask = useUpdateTask();

  const [open, setOpen] = useState(false);
  const [assignTo, setAssignTo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(() => nextDistinctColor([]));

  useFlussoEvent(
    "flusso:new-project",
    useCallback(({ assignToTaskId }) => {
      setAssignTo(assignToTaskId ?? null);
      setName("");
      setOpen(true);
    }, []),
  );

  /*
   * Il colore si sceglie all'apertura, non alla creazione: l'utente deve poter
   * vedere quale gli è stato proposto e cambiarlo prima di confermare. Ed è
   * quello **libero**, non il primo della tavolozza: due progetti creati di
   * fila nascevano dello stesso verde, e sul calendario il colore è l'unica
   * cosa che dice a chi appartiene un blocco.
   */
  useEffect(() => {
    if (open) setColor(nextDistinctColor(active.map((one) => one.color)));
  }, [active, open]);

  const salva = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    create.mutate(
      { name: trimmed, color },
      {
        onSuccess: (project) => {
          if (assignTo) {
            updateTask.mutate({ id: assignTo, project_id: project.id });
          }
          toast.success(
            assignTo
              ? `Progetto «${project.name}» creato e assegnato.`
              : `Progetto «${project.name}» creato.`,
          );
        },
      },
    );
    setOpen(false);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Nuovo progetto"
      description={
        assignTo
          ? "Il task su cui stai lavorando ci finisce dentro appena lo crei."
          : "Il colore distingue i suoi blocchi sul calendario."
      }
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-soft flex-1"
            onClick={() => setOpen(false)}
          >
            Annulla
          </button>
          <button
            type="button"
            className="btn btn-primary flex-1"
            onClick={salva}
            disabled={!name.trim()}
          >
            Crea
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label mb-1.5 block" htmlFor="nuovo-progetto-nome">
            Nome
          </label>
          <input
            id="nuovo-progetto-nome"
            autoFocus
            className="field"
            placeholder="Tesi, Casa, Cliente X…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                salva();
              }
            }}
          />
        </div>

        <div>
          <p className="label mb-1.5">Colore</p>
          <ColorPicker
            value={color}
            onChange={setColor}
            label="Colore del progetto"
          />
          <p className="mt-1.5 text-xs text-ink-faint">
            Ne è già proposto uno che nessun altro progetto sta usando.
          </p>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
