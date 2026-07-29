"use client";

import { useCallback, useState } from "react";

import { DataPanel } from "@/components/settings/data-panel";
import { GooglePanel } from "@/components/settings/google-panel";
import { HoursPanel } from "@/components/settings/hours-panel";
import { ProjectsPanel } from "@/components/settings/projects-panel";
import { RecurringPanel } from "@/components/settings/recurring-panel";
import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { useFlussoEvent } from "@/lib/events";

const TABS = [
  { id: "giornata", label: "Giornata" },
  { id: "progetti", label: "Progetti" },
  { id: "ricorrenti", label: "Ricorrenti" },
  { id: "google", label: "Google" },
  { id: "dati", label: "Dati" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/**
 * Le impostazioni, in cinque schede.
 *
 * Ogni pannello salva **subito**, senza un pulsante «Salva»: sono preferenze,
 * non un modulo. Un pulsante di conferma qui produrrebbe solo modifiche
 * perse chiudendo la scheda.
 */
export function SettingsSheet() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("giornata");

  useFlussoEvent(
    "flusso:open-settings",
    useCallback(() => setOpen(true), []),
  );

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={setOpen}
      title="Impostazioni"
      className="app:w-[min(40rem,calc(100vw-4rem))]"
    >
      <div
        role="tablist"
        aria-label="Sezioni delle impostazioni"
        className="scroll-quiet sticky top-0 z-10 -mx-5 mb-3 flex gap-1 overflow-x-auto bg-surface px-5 pb-2"
      >
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            onClick={() => setTab(one.id)}
            className={
              tab === one.id
                ? "chip chip-accent shrink-0"
                : "chip shrink-0 text-ink-soft"
            }
          >
            {one.label}
          </button>
        ))}
      </div>

      <div className="pb-2">
        {tab === "giornata" && <HoursPanel />}
        {tab === "progetti" && <ProjectsPanel />}
        {tab === "ricorrenti" && <RecurringPanel />}
        {tab === "google" && <GooglePanel />}
        {tab === "dati" && <DataPanel />}
      </div>
    </ResponsiveSheet>
  );
}
