"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

/**
 * Un `<select>` nativo vestito con i token.
 *
 * Su telefono la ruota di sistema è più veloce e più accessibile di qualsiasi
 * elenco costruito a mano, e non ha bisogno di essere reimparata: il comfort
 * desktop qui non vale la perdita di quel vantaggio.
 */
export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "field h-10 min-h-10 w-full appearance-none py-0 pr-8 text-sm",
          !value && "text-ink-faint",
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
      />
    </div>
  );
}
