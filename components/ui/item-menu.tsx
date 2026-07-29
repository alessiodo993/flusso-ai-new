"use client";

import * as ContextMenu from "@radix-ui/react-context-menu";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { ResponsiveSheet } from "@/components/shell/responsive-sheet";
import { useIsTouch } from "@/lib/hooks/use-media-query";
import { cn, haptic } from "@/lib/utils";

export type MenuItem = {
  id: string;
  label: string;
  Icon?: LucideIcon;
  onSelect: () => void;
  tone?: "danger";
  separatorBefore?: boolean;
};

const LONG_PRESS_MS = 500;

/**
 * Lo stesso elenco di azioni, con il gesto giusto per il dispositivo:
 * tasto destro dove c'è un puntatore, pressione prolungata dove non c'è.
 *
 * Su touch il menu contestuale nativo viene soppresso di proposito: comparire
 * *insieme* all'action sheet è il modo più rapido per rendere una card
 * inutilizzabile con il pollice.
 */
export function ItemMenu({
  items,
  title,
  children,
  className,
}: {
  items: MenuItem[];
  /** Intestazione dell'action sheet: di solito il titolo dell'elemento. */
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const isTouch = useIsTouch();
  const [sheetOpen, setSheetOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const moved = useRef(false);

  function cancel() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  if (isTouch) {
    return (
      <>
        <div
          className={className}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={() => {
            moved.current = false;
            cancel();
            timer.current = window.setTimeout(() => {
              // Uno scorrimento non è una pressione prolungata.
              if (moved.current) return;
              haptic(12);
              setSheetOpen(true);
            }, LONG_PRESS_MS);
          }}
          onPointerMove={() => {
            moved.current = true;
            cancel();
          }}
          onPointerUp={cancel}
          onPointerCancel={cancel}
        >
          {children}
        </div>

        <ResponsiveSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={title}
        >
          <ul className="pb-3">
            {items.map((item) => (
              <li key={item.id}>
                {item.separatorBefore && <div className="hairline my-1.5" />}
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-flusso-sm px-2 text-left text-[15px]",
                    item.tone === "danger" ? "text-danger" : "text-ink",
                  )}
                >
                  {item.Icon && <item.Icon className="size-[18px] shrink-0" />}
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </ResponsiveSheet>
      </>
    );
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger className={className}>
        {children}
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className="anim-pop z-50 min-w-52 rounded-flusso-sm border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
          collisionPadding={8}
        >
          {items.map((item) => (
            <div key={item.id}>
              {item.separatorBefore && (
                <ContextMenu.Separator className="my-1.5 h-px bg-line" />
              )}
              <ContextMenu.Item
                onSelect={item.onSelect}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-flusso-sm px-2.5 py-2 text-sm outline-none",
                  "data-[highlighted]:bg-accent-soft",
                  item.tone === "danger" ? "text-danger" : "text-ink",
                )}
              >
                {item.Icon && <item.Icon className="size-4 shrink-0" />}
                {item.label}
              </ContextMenu.Item>
            </div>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
