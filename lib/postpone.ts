import { emit } from "@/lib/events";
import type { DayISO } from "@/lib/time";
import type { Task } from "@/lib/types";

/**
 * Spostare **in avanti** un blocco già pianificato è un rinvio; spostarlo
 * dentro la stessa giornata, o anticiparlo, no.
 *
 * La distinzione conta: senza, riordinare la mattinata gonfierebbe il
 * contatore dei rinvii e il dialogo del terzo rinvio comparirebbe a chi sta
 * semplicemente sistemando l'agenda.
 */
export function isPostponement(task: Task, toDay: DayISO | null): boolean {
  if (task.day === null) return false;
  if (toDay === null) return true; // tolto dal calendario e rimandato a data da destinarsi
  return toDay > task.day;
}

/**
 * Sposta un task, contandolo come rinvio quando lo è.
 *
 * Passa sempre dall'evento e mai dalla mutazione diretta: è lì che scatta
 * l'attrito del terzo rinvio, e scavalcarlo lo renderebbe aggirabile.
 */
export function moveTask({
  task,
  day,
  startMinute,
  schedule,
}: {
  task: Task;
  day: DayISO;
  startMinute: number;
  /** La mutazione da usare quando non è un rinvio. */
  schedule: (input: { id: string; day: DayISO; startMinute: number }) => void;
}): void {
  if (isPostponement(task, day)) {
    emit("flusso:postpone", { taskId: task.id, day, startMinute });
    return;
  }
  schedule({ id: task.id, day, startMinute });
}

/**
 * Da quanti rinvii in poi si offre il micro-avvio.
 *
 * Due, non uno: il primo rinvio è vita normale — è arrivata una riunione, il
 * treno era in ritardo. Dal secondo in poi il problema non è più l'agenda, è
 * l'inizio; e a quel punto un permesso esplicito di fermarsi dopo dieci
 * minuti vale più di qualunque promemoria.
 */
export const MICRO_START_FROM = 2;

/**
 * Vero se a questo task conviene offrire «Solo 10 minuti».
 *
 * Offrirlo su tutto lo svaluterebbe: su un task che parte volentieri non
 * serve un permesso di fermarsi. Restano fuori anche i task già completati,
 * per ovvie ragioni, e quelli archiviati.
 */
export function needsMicroStart(task: Task): boolean {
  return (
    task.status !== "done" &&
    task.status_review !== "archived" &&
    task.postpone_count >= MICRO_START_FROM
  );
}
