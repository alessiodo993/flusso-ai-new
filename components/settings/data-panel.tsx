"use client";

import { Download, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  backupFilename,
  parseBackup,
  summarize,
  type Backup,
} from "@/lib/backup";
import { useExportBackup, useImportBackup } from "@/lib/hooks/use-backup";

/**
 * Portare via i propri dati, e riportarli dentro.
 *
 * L'import **aggiunge**, non sostituisce: sovrascrivere sarebbe l'operazione
 * più distruttiva dell'app, e non c'è modo di annullarla con un toast da
 * cinque secondi. Chi vuole ripartire da zero può svuotare a mano.
 */
export function DataPanel() {
  const exportBackup = useExportBackup();
  const importBackup = useImportBackup();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Backup | null>(null);

  async function download() {
    const backup = await exportBackup.mutateAsync();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = backupFilename();
    link.click();
    URL.revokeObjectURL(url);
  }

  async function read(file: File) {
    try {
      setPending(parseBackup(await file.text()));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "File non leggibile.",
      );
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        Un file JSON con progetti, task, idee, obiettivi, impegni fissi e
        ricorrenze. Leggibile a occhio, e senza riferimenti al tuo account:
        può rientrare anche altrove.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => void download()}
          disabled={exportBackup.isPending}
        >
          {exportBackup.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Esporta
        </button>

        <button
          type="button"
          className="btn btn-soft"
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" />
          Importa
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Scegli il file da importare"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
            // Così riselezionare lo stesso file rifà partire l'evento.
            event.target.value = "";
          }}
        />
      </div>

      {pending && (
        <div className="rounded-flusso-md border border-line bg-sunken p-3">
          <p className="text-sm font-medium">Sta per entrare:</p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-ink-soft">
            {Object.entries(summarize(pending))
              .filter(([, count]) => count > 0)
              .map(([label, count]) => (
                <li key={label}>
                  <span className="tnum">{count}</span> {label}
                </li>
              ))}
          </ul>

          <p className="mt-2 text-xs text-ink-faint">
            Le righe si aggiungono a quelle che hai già: niente viene
            sostituito o cancellato.
          </p>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="btn btn-soft h-8 flex-1 text-xs"
              onClick={() => setPending(null)}
            >
              Annulla
            </button>
            <button
              type="button"
              className="btn btn-primary h-8 flex-1 text-xs"
              disabled={importBackup.isPending}
              onClick={async () => {
                const result = await importBackup.mutateAsync(pending);
                setPending(null);
                toast.success(
                  `Importate ${result.inserted} righe${
                    result.skipped > 0
                      ? `, ${result.skipped} già presenti`
                      : ""
                  }.`,
                );
              }}
            >
              {importBackup.isPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              Importa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
