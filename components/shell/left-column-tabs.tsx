"use client";

import { PanelLeftClose } from "lucide-react";

import { SECTION_LABEL, type Section } from "@/lib/events";

const TABS = ["idee", "lista", "obiettivi"] as const;

/**
 * Il selettore della colonna sinistra, solo da desktop: sul telefono lo stesso
 * compito ce l'ha la BottomNav, e due controlli per la stessa cosa sarebbero
 * rumore.
 */
export function LeftColumnTabs({
  value,
  onChange,
  collapsed,
  onToggleCollapse,
}: {
  value: Section;
  onChange: (section: Section) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <div className="mb-3 hidden items-center gap-2 app:flex">
      <div className="seg" role="tablist" aria-label="Sezione">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={value === tab}
            data-on={value === tab}
            onClick={() => onChange(tab)}
          >
            {SECTION_LABEL[tab]}
          </button>
        ))}
      </div>

      {!collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Nascondi la colonna e allarga il calendario"
          className="icon-btn ml-auto"
        >
          <PanelLeftClose className="size-[18px]" />
        </button>
      )}
    </div>
  );
}
