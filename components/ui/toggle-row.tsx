"use client";

import * as Switch from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * Una riga con un interruttore. La riga intera è l'etichetta, così il
 * bersaglio tattile è largo quanto lo schermo e non quanto il pallino.
 */
export function ToggleRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center justify-between gap-3 py-1",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && (
          <span className="block text-xs text-ink-faint">{hint}</span>
        )}
      </span>

      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-150",
          checked ? "border-accent bg-accent" : "border-line-strong bg-sunken",
        )}
      >
        <Switch.Thumb
          className={cn(
            "block size-5 rounded-full bg-surface shadow-[var(--shadow-lift)] transition-transform duration-150",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </Switch.Root>
    </label>
  );
}
