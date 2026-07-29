import { cn } from "@/lib/utils";

/**
 * Il marchio è un cerchio verde pieno: stesso segno del favicon, della PWA e
 * dell'header dell'app. Nessuna variante, nessun gradiente.
 */
export function Logo({
  className,
  size = 24,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 rounded-full bg-accent", className)}
      style={{ width: size, height: size }}
    />
  );
}
