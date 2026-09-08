"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Pannello laterale per il back-office (dettaglio lead, filtri, anteprima
 * intervento). Stessa base accessibile della modale: cambia solo la posizione.
 */
export function Cassetto({
  trigger,
  titolo,
  descrizione,
  children,
  piede,
  aperto,
  onApertoChange,
  lato = "destra",
}: {
  trigger?: ReactNode;
  titolo: string;
  descrizione?: string;
  children: ReactNode;
  piede?: ReactNode;
  aperto?: boolean;
  onApertoChange?: (v: boolean) => void;
  lato?: "destra" | "sinistra";
}) {
  return (
    <Dialog.Root open={aperto} onOpenChange={onApertoChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-fondo/80 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 z-50 flex w-full max-w-xl flex-col border-bordo bg-superficie-alta shadow-fluttuante",
            lato === "destra" ? "right-0 border-l" : "left-0 border-r",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-bordo px-6 py-5">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="truncate text-lg font-semibold text-testo">
                {titolo}
              </Dialog.Title>
              {descrizione ? (
                <Dialog.Description className="text-sm text-testo-tenue">
                  {descrizione}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Chiudi"
              className="garbo -mt-1 -mr-1 rounded-md p-1.5 text-testo-tenue hover:bg-superficie-viva hover:text-testo"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {piede ? (
            <div className="flex items-center justify-end gap-3 border-t border-bordo px-6 py-4">
              {piede}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
