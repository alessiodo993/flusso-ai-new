"use client";

import { Moon, RefreshCw, Search, Settings, Sun } from "lucide-react";
import { useMemo } from "react";

import { Logo } from "@/components/shell/logo";
import { useTheme } from "@/components/shell/theme-provider";
import { emit, goto } from "@/lib/events";
import { useTasks } from "@/lib/hooks/use-tasks";
import { deadlineTone, fmtDayShort, todayISO } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * Barra fissa in alto. Deve dire tre cose senza che l'utente chieda nulla:
 * che giorno è, quanto sta bruciando, e come uscire da lì.
 */
export function AppHeader({ onRefresh }: { onRefresh?: () => void }) {
  const today = todayISO();
  const { tasks } = useTasks();
  const { resolved, toggle } = useTheme();

  /** Aperti e in scadenza: scaduti, di oggi o entro due giorni. */
  const dueCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "inbox" &&
          task.status_review !== "archived" &&
          task.deadline !== null &&
          deadlineTone(task.deadline, today) !== "later",
      ).length,
    [tasks, today],
  );

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[100rem] items-center gap-2 px-4 app:px-6">
        <Logo size={22} />
        <time
          dateTime={today}
          className="ml-1 truncate text-sm font-medium first-letter:uppercase"
        >
          {fmtDayShort(today)}
        </time>

        {dueCount > 0 && (
          <button
            type="button"
            onClick={() => goto("lista", { deadlineSoon: true })}
            className={cn(
              "chip chip-warn ml-1 cursor-pointer transition-colors hover:brightness-95",
            )}
          >
            <span className="tnum font-medium">{dueCount}</span>
            <span className="hidden sm:inline">in scadenza</span>
          </button>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className="icon-btn hidden app:inline-flex"
            aria-label="Cerca e comandi rapidi"
            title="Comandi rapidi (⌘K)"
            onClick={() => emit("flusso:open-palette", {})}
          >
            <Search className="size-[18px]" />
          </button>

          {onRefresh && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Aggiorna i calendari"
              onClick={onRefresh}
            >
              <RefreshCw className="size-[18px]" />
            </button>
          )}

          <button
            type="button"
            className="icon-btn"
            aria-label={
              resolved === "dark" ? "Passa al tema chiaro" : "Passa al tema scuro"
            }
            onClick={toggle}
          >
            {resolved === "dark" ? (
              <Sun className="size-[18px]" />
            ) : (
              <Moon className="size-[18px]" />
            )}
          </button>

          <button
            type="button"
            className="icon-btn"
            aria-label="Impostazioni"
            onClick={() => emit("flusso:open-settings", {})}
          >
            <Settings className="size-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
