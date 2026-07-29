"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { buildBackup, type Backup } from "@/lib/backup";
import { supabaseBrowser } from "@/lib/supabase/client";
import { toOkr, toRecurring, toTask } from "@/lib/types";

/**
 * Export e import verso il database.
 *
 * L'import riusa **gli stessi id** del file: è ciò che rende l'operazione
 * ripetibile senza moltiplicare le righe — reimportare due volte lo stesso
 * file non crea doppioni, perché `ignoreDuplicates` scarta le chiavi già
 * presenti. È anche il motivo per cui i riferimenti fra tabelle (task →
 * progetto, obiettivo → progetto) restano validi.
 */
export function useExportBackup() {
  return useMutation({
    mutationFn: async (): Promise<Backup> => {
      const supabase = supabaseBrowser();

      const [settings, projects, tasks, ideas, okrs, blocks, recurring] =
        await Promise.all([
          supabase.from("user_settings").select("*").maybeSingle(),
          supabase.from("projects").select("*").order("sort_order"),
          supabase.from("tasks").select("*"),
          supabase.from("ideas").select("*"),
          supabase.from("okrs").select("*"),
          supabase.from("blocks").select("*"),
          supabase.from("recurring").select("*"),
        ]);

      const failed = [settings, projects, tasks, ideas, okrs, blocks, recurring]
        .map((result) => result.error)
        .find(Boolean);
      if (failed) throw failed;

      return buildBackup({
        settings: settings.data ?? null,
        projects: projects.data ?? [],
        tasks: (tasks.data ?? []).map(toTask),
        ideas: ideas.data ?? [],
        okrs: (okrs.data ?? []).map(toOkr),
        blocks: blocks.data ?? [],
        recurring: (recurring.data ?? []).map(toRecurring),
      });
    },
  });
}

export function useImportBackup() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (backup: Backup) => {
      const supabase = supabaseBrowser();
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;
      if (!userId) throw new Error("Sessione scaduta. Accedi di nuovo.");

      const own = <T extends object>(rows: T[]) =>
        rows.map((row) => ({ ...row, user_id: userId }));

      let inserted = 0;
      let skipped = 0;

      /*
       * L'ordine conta: i progetti prima di tutto ciò che li referenzia,
       * altrimenti la chiave esterna rifiuta le righe figlie. Le righe già
       * presenti si contano come saltate invece di far fallire l'import.
       */
      const steps: Array<[string, object[]]> = [
        ["projects", backup.projects],
        ["tasks", backup.tasks],
        ["ideas", backup.ideas],
        ["okrs", backup.okrs],
        ["blocks", backup.blocks],
        ["recurring", backup.recurring],
      ];

      for (const [table, rows] of steps) {
        if (rows.length === 0) continue;

        const { data, error } = await supabase
          // I nomi delle tabelle sono letterali di questo file, non input.
          .from(table as "projects")
          .upsert(own(rows) as never, {
            onConflict: "id",
            ignoreDuplicates: true,
          })
          .select("id");

        if (error) throw error;
        inserted += data?.length ?? 0;
        skipped += rows.length - (data?.length ?? 0);
      }

      if (backup.settings) {
        const { error } = await supabase
          .from("user_settings")
          .update(backup.settings)
          .eq("user_id", userId);
        if (error) throw error;
      }

      return { inserted, skipped };
    },
    onSuccess: () => {
      // Un import tocca quasi tutto: qui l'invalidazione mirata sarebbe
      // l'elenco completo delle chiavi, cioè nessuna mira.
      void client.invalidateQueries();
    },
  });
}
