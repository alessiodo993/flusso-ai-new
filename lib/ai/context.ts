import { AiError } from "@/lib/ai/client";
import { supabaseServer } from "@/lib/supabase/server";
import { toTask, type Project, type Task } from "@/lib/types";

/**
 * Il contesto che le route AI mandano al modello.
 *
 * Lo legge il server, non il browser: se fosse il client a spedire l'elenco
 * dei task, un id inventato basterebbe a far proporre un'operazione su una
 * riga altrui. Le RLS reggerebbero comunque la scrittura, ma la proposta
 * arriverebbe all'utente già sporca — meglio non arrivarci.
 */
export async function loadContext(): Promise<{
  tasks: Task[];
  projects: Project[];
}> {
  const supabase = await supabaseServer();

  const [tasks, projects] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .neq("status_review", "archived")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("projects")
      .select("*")
      .eq("archived", false)
      .order("sort_order"),
  ]);

  if (tasks.error) throw new AiError("unknown", tasks.error.message);
  if (projects.error) throw new AiError("unknown", projects.error.message);

  return {
    tasks: (tasks.data ?? []).map(toTask),
    projects: projects.data ?? [],
  };
}
