"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  CalendarDays,
  Lightbulb,
  ListChecks,
  Mic,
  Moon,
  Play,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  Wand2,
  MoonStar,
  BarChart3,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "@/components/shell/theme-provider";
import { emit, goto, useFlussoEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  hint?: string;
  Icon: typeof Play;
  run: () => void;
};

/**
 * Comandi rapidi da tastiera. Non è una ricerca sui contenuti: è il modo per
 * arrivare ovunque senza staccare le mani, che su desktop è metà del valore.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { resolved, toggle } = useTheme();

  useFlussoEvent(
    "flusso:open-palette",
    useCallback(() => setOpen(true), []),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      {
        id: "adesso",
        label: "Adesso",
        hint: "Avvia il blocco in corso",
        Icon: Play,
        run: () => emit("flusso:focus-now", {}),
      },
      {
        id: "nuovo-task",
        label: "Nuovo task",
        Icon: Plus,
        run: () => {
          goto("lista");
          emit("flusso:quick-capture", {});
        },
      },
      {
        id: "nuova-idea",
        label: "Nuova idea",
        Icon: Lightbulb,
        run: () => {
          goto("idee");
          emit("flusso:quick-capture", {});
        },
      },
      {
        id: "cattura-magica",
        label: "Cattura magica",
        hint: "Scrivi o detta, interpreta l'AI",
        Icon: Wand2,
        run: () => emit("flusso:magic-capture", {}),
      },
      {
        id: "cattura-voce",
        label: "Cattura a voce",
        hint: "Detta e lascia interpretare all'AI",
        Icon: Mic,
        run: () => emit("flusso:magic-capture", { voice: true }),
      },
      {
        id: "pianifica",
        label: "Pianifica con AI",
        Icon: Sparkles,
        run: () => emit("flusso:open-planner", {}),
      },
      {
        id: "calibrazione",
        label: "Realtà vs Piano",
        hint: "Quanto pianifichi, quanto esegui",
        Icon: BarChart3,
        run: () => emit("flusso:open-calibration", {}),
      },
      {
        id: "kickoff",
        label: "Apri la giornata",
        hint: "Rituale di kickoff",
        Icon: Sunrise,
        run: () => emit("flusso:open-kickoff", {}),
      },
      {
        id: "shutdown",
        label: "Chiudi la giornata",
        hint: "Rituale di shutdown",
        Icon: MoonStar,
        run: () => emit("flusso:open-shutdown", {}),
      },
      {
        id: "vai-idee",
        label: "Vai a Idee",
        Icon: Lightbulb,
        run: () => goto("idee"),
      },
      {
        id: "vai-lista",
        label: "Vai a Lista",
        Icon: ListChecks,
        run: () => goto("lista"),
      },
      {
        id: "vai-calendario",
        label: "Vai al Calendario",
        Icon: CalendarDays,
        run: () => goto("calendario"),
      },
      {
        id: "vai-obiettivi",
        label: "Vai a Obiettivi",
        Icon: Target,
        run: () => goto("obiettivi"),
      },
      {
        id: "tema",
        label: resolved === "dark" ? "Tema chiaro" : "Tema scuro",
        Icon: resolved === "dark" ? Sun : Moon,
        run: toggle,
      },
      {
        id: "impostazioni",
        label: "Impostazioni",
        Icon: Settings,
        run: () => emit("flusso:open-settings", {}),
      },
    ],
    [resolved, toggle],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((command) =>
      `${command.label} ${command.hint ?? ""}`.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  // Un filtro più stretto può lasciare l'indice oltre la fine della lista.
  const selected = Math.min(active, Math.max(0, results.length - 1));

  function runAt(index: number) {
    const command = results[index];
    if (!command) return;
    setOpen(false);
    setQuery("");
    setActive(0);
    command.run();
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "anim-pop fixed left-1/2 top-[12vh] z-50 w-[min(32rem,calc(100vw-2rem))]",
            "-translate-x-1/2 overflow-hidden rounded-flusso-lg border border-line",
            "bg-surface shadow-[var(--shadow-pop)]",
          )}
          onOpenAutoFocus={(event) => {
            // Il focus va al campo, non al primo elemento navigabile.
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <VisuallyHidden asChild>
            <Dialog.Title>Comandi rapidi</Dialog.Title>
          </VisuallyHidden>
          <VisuallyHidden asChild>
            <Dialog.Description>
              Cerca una sezione o un&apos;azione e premi Invio.
            </Dialog.Description>
          </VisuallyHidden>

          <input
            ref={inputRef}
            className="field field-bare h-12 rounded-none border-b border-line px-4 text-base"
            placeholder="Cerca un comando…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                runAt(selected);
              }
            }}
          />

          <ul className="scroll-quiet max-h-[min(24rem,60vh)] overflow-y-auto p-1.5">
            {results.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-ink-faint">
                Nessun comando per «{query}».
              </li>
            )}

            {results.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => runAt(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-flusso-sm px-3 py-2.5 text-left text-sm",
                    index === selected ? "bg-accent-soft text-ink" : "text-ink-soft",
                  )}
                >
                  <command.Icon className="size-4 shrink-0 text-ink-faint" />
                  <span className="truncate font-medium text-ink">
                    {command.label}
                  </span>
                  {command.hint && (
                    <span className="ml-auto hidden truncate text-xs text-ink-faint sm:block">
                      {command.hint}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
