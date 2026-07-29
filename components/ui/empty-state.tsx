import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Nessuno stato vuoto è un vicolo cieco: ogni schermata senza contenuti dice
 * cosa sta succedendo e offre l'azione successiva.
 */
export function EmptyState({
  Icon,
  title,
  description,
  action,
  className,
}: {
  Icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon className="size-5" />
        </span>
      )}

      <p className="font-display text-lg text-balance">{title}</p>

      {description && (
        <p className="mt-1.5 max-w-xs text-pretty text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
