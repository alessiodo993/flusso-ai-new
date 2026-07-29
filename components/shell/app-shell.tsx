"use client";

import { PanelLeftOpen } from "lucide-react";
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CalendarSection } from "@/components/calendar/calendar-section";
import { IdeasSection } from "@/components/ideas/ideas-section";
import { ListSection } from "@/components/list/list-section";
import { OkrSection } from "@/components/okr/okr-section";
import { AppHeader } from "@/components/shell/header";
import { BottomNav } from "@/components/shell/bottom-nav";
import { CommandPalette } from "@/components/shell/command-palette";
import { LeftColumnTabs } from "@/components/shell/left-column-tabs";
import { QuickCaptureFab } from "@/components/shell/quick-capture-fab";
import { useFlussoEvent, type ListFilter, type Section } from "@/lib/events";
import { cn } from "@/lib/utils";

/** Le sezioni che vivono nella colonna di sinistra su desktop. */
type LeftSection = Exclude<Section, "calendario">;

/**
 * Unica schermata protetta dell'app.
 *
 * Il layout lo decide interamente il CSS: su telefono si vede una sezione per
 * volta, da 1080px in su la sinistra e il calendario convivono in una griglia
 * 5/7 con due scorrimenti indipendenti. Nessun ramo dipende dalla larghezza
 * misurata in JavaScript, quindi non c'è nulla da riconciliare all'idratazione
 * e non si vede alcun salto al primo render.
 */
export function AppShell() {
  // Si apre sul calendario: se non è lì, non succede.
  const [section, setSectionState] = useState<Section>("calendario");
  const [leftSection, setLeftSection] = useState<LeftSection>("lista");
  const [collapsed, setCollapsed] = useState(false);
  const [listFilter, setListFilter] = useState<ListFilter | null>(null);

  const queryClient = useQueryClient();

  const setSection = useCallback((next: Section) => {
    setSectionState(next);
    if (next !== "calendario") setLeftSection(next);
  }, []);

  useFlussoEvent(
    "flusso:goto",
    useCallback(
      ({ section: next, filter }) => {
        setSection(next);
        // Il filtro vale per l'apertura corrente: chi arriva dal badge
        // "in scadenza" deve trovare la Lista già ristretta.
        if (next === "lista") setListFilter(filter ?? null);
        if (next !== "calendario") setCollapsed(false);
      },
      [setSection],
    ),
  );

  const refreshCalendars = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["google"] });
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Calendari aggiornati.");
  }, [queryClient]);

  const showingOkr = section === "obiettivi";
  // Su desktop la colonna sinistra sparisce solo se richiusa a mano.
  const oneColumn = showingOkr || collapsed;

  return (
    <div className="min-h-dvh">
      <AppHeader onRefresh={refreshCalendars} />

      <main className="mx-auto max-w-[100rem] px-4 pb-nav pt-4 app:px-6 app:pb-8">
        <div
          className={cn(
            "app:grid app:items-start app:gap-5",
            oneColumn ? "app:grid-cols-1" : "app:grid-cols-[5fr_7fr]",
          )}
        >
          {/* Colonna sinistra — su telefono è la sezione corrente. */}
          <div
            className={cn(
              // `min-w-0` è obbligatorio: senza, il contenuto largo di una
              // colonna allarga la griglia oltre lo schermo.
              "min-w-0",
              section === "calendario" && "hidden app:block",
              collapsed && "app:hidden",
              showingOkr && "app:mx-auto app:w-full app:max-w-5xl",
            )}
          >
            <div className="scroll-quiet app:sticky app:top-16 app:max-h-[calc(100vh-5rem)] app:overflow-y-auto app:pb-4">
              <LeftColumnTabs
                value={leftSection}
                onChange={setSection}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
              />

              {leftSection === "idee" && <IdeasSection />}
              {leftSection === "lista" && (
                <ListSection
                  filter={listFilter}
                  onClearFilter={() => setListFilter(null)}
                />
              )}
              {leftSection === "obiettivi" && <OkrSection />}
            </div>
          </div>

          {/* Colonna destra — il calendario, che su Obiettivi si ritira. */}
          <div
            className={cn(
              "min-w-0",
              section === "calendario" ? "block" : "hidden app:block",
              showingOkr && "app:hidden",
              collapsed && "app:mx-auto app:w-full app:max-w-[880px]",
            )}
          >
            <div className="scroll-quiet app:sticky app:top-16 app:max-h-[calc(100vh-5rem)] app:overflow-y-auto app:pb-4">
              <CalendarSection />
            </div>
          </div>
        </div>
      </main>

      {/* Riapertura della colonna richiusa: flottante, per non rubare spazio. */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Riapri la colonna di sinistra"
          className="icon-btn fixed left-4 top-20 z-20 hidden border border-line bg-surface shadow-[var(--shadow-lift)] app:inline-flex"
        >
          <PanelLeftOpen className="size-[18px]" />
        </button>
      )}

      <BottomNav section={section} onSelect={setSection} />
      <QuickCaptureFab />
      <CommandPalette />
    </div>
  );
}
