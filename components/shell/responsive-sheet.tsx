"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ResponsiveSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Nasconde il titolo visivamente ma lo lascia agli screen reader. */
  hideTitle?: boolean;
  description?: string;
  children: React.ReactNode;
  /** Barra di azioni ancorata in fondo, fuori dallo scorrimento. */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Lo stesso contenuto in due forme: bottom-sheet sul telefono, dialog centrato
 * da 1080px in su. La differenza è tutta nel CSS, così non serve sapere in
 * JavaScript su che schermo siamo e non c'è nulla da riconciliare
 * all'idratazione.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  hideTitle,
  description,
  children,
  footer,
  className,
}: ResponsiveSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px]" />

        <Dialog.Content
          className={cn(
            "anim-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col",
            "rounded-t-flusso-lg border border-line bg-surface shadow-[var(--shadow-pop)]",
            // Da desktop diventa un dialog centrato e di larghezza contenuta.
            "app:anim-pop app:inset-auto app:left-1/2 app:top-1/2 app:w-[min(34rem,calc(100vw-4rem))]",
            "app:max-h-[min(44rem,calc(100vh-6rem))] app:-translate-x-1/2 app:-translate-y-1/2",
            "app:rounded-flusso-lg",
            className,
          )}
        >
          {/* Il trattino è l'affordance del trascinamento, solo su telefono. */}
          <div
            aria-hidden="true"
            className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-strong app:hidden"
          />

          <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
              {hideTitle ? (
                <VisuallyHidden asChild>
                  <Dialog.Title>{title}</Dialog.Title>
                </VisuallyHidden>
              ) : (
                <Dialog.Title className="truncate font-display text-xl">
                  {title}
                </Dialog.Title>
              )}

              {description ? (
                <Dialog.Description className="mt-1 text-sm text-ink-soft">
                  {description}
                </Dialog.Description>
              ) : (
                <VisuallyHidden asChild>
                  <Dialog.Description>{title}</Dialog.Description>
                </VisuallyHidden>
              )}
            </div>

            <Dialog.Close
              className="icon-btn -mr-2.5 -mt-2 shrink-0"
              aria-label="Chiudi"
            >
              <X className="size-5" />
            </Dialog.Close>
          </header>

          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pb-2">
            {children}
          </div>

          {footer && (
            <div className="hairline shrink-0 px-5 pb-safe pt-3 app:pb-4">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
