"use client";

import { CalendarDays, Lightbulb, ListChecks, Play, Target } from "lucide-react";

import { emit, type Section } from "@/lib/events";
import { cn } from "@/lib/utils";

const SLOTS = [
  { section: "idee" as const, label: "Idee", Icon: Lightbulb },
  { section: "lista" as const, label: "Lista", Icon: ListChecks },
  { section: "calendario" as const, label: "Pianifica", Icon: CalendarDays },
  { section: "obiettivi" as const, label: "Obiettivi", Icon: Target },
];

/**
 * Cinque slot, con «Adesso» rialzato al centro. È il pulsante più importante
 * dell'app: avviare deve costare un tocco, e deve stare dove sta il pollice.
 */
export function BottomNav({
  section,
  onSelect,
}: {
  section: Section;
  onSelect: (section: Section) => void;
}) {
  const [left, right] = [SLOTS.slice(0, 2), SLOTS.slice(2)];

  return (
    <nav
      aria-label="Sezioni"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 pb-safe backdrop-blur-md app:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2">
        {left.map((slot) => (
          <NavButton
            key={slot.section}
            {...slot}
            active={section === slot.section}
            onSelect={onSelect}
          />
        ))}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => emit("flusso:focus-now", {})}
            aria-label="Adesso: avvia il blocco in corso"
            className={cn(
              "-mt-5 flex size-14 flex-col items-center justify-center gap-0.5",
              "rounded-full bg-accent text-accent-ink shadow-[var(--shadow-pop)]",
              "transition-transform duration-150 ease-out active:scale-95",
            )}
          >
            <Play className="size-5 fill-current" />
            <span className="text-[10px] font-medium leading-none">Adesso</span>
          </button>
        </div>

        {right.map((slot) => (
          <NavButton
            key={slot.section}
            {...slot}
            active={section === slot.section}
            onSelect={onSelect}
          />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  section,
  label,
  Icon,
  active,
  onSelect,
}: {
  section: Section;
  label: string;
  Icon: typeof Lightbulb;
  active: boolean;
  onSelect: (section: Section) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(section)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-flusso-sm py-2",
        "text-[11px] font-medium transition-colors duration-150 ease-out",
        active ? "text-accent" : "text-ink-faint",
      )}
    >
      <Icon className={cn("size-5", active && "stroke-[2.25]")} />
      {label}
    </button>
  );
}
