"use client";

import { PROJECT_COLORS, safeColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

/**
 * La scelta del colore di un progetto.
 *
 * Vive qui e non dentro le Impostazioni perché ora la usano tre punti diversi:
 * il pannello dei progetti, la creazione rapida e il Task Sheet. Una copia per
 * ciascuno avrebbe garantito che prima o poi divergessero.
 */
export function ColorPicker({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={color}
          aria-pressed={safeColor(value) === color}
          onClick={() => onChange(color)}
          className={cn(
            "size-7 rounded-full border-2 transition-transform duration-150",
            safeColor(value) === color
              ? "border-ink scale-110"
              : "border-transparent",
          )}
          style={{ background: color }}
        />
      ))}
    </div>
  );
}
