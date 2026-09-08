"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Modale accessibile (focus trap, Esc, aria-modal) su Radix Dialog.
 * `descrizione` alimenta aria-describedby: se manca, Radix avverte in console.
 */
export function Modale({
  trigger,
  titolo,
  descrizione,
  children,
  piede,
  aperta,
  onApertaChange,
  larghezza = "media",
}: {
  trigger?: ReactNode;
  titolo: string;
  descrizione?: string;
  children: ReactNode;
  piede?: ReactNode;
  aperta?: boolean;
  onApertaChange?: (v: boolean) => void;
  larghezza?: "stretta" | "media" | "ampia";
}) {
  const larghezze = {
    stretta: "max-w-md",
    media: "max-w-lg",
    ampia: "max-w-3xl",
  } as const;
  return (
    <Dialog.Root open={aperta} onOpenChange={onApertaChange}>
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-fondo/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-xl border border-bordo bg-superficie-alta shadow-fluttuante",
            larghezze[larghezza],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-bordo px-6 py-5">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-lg font-semibold text-testo">{titolo}</Dialog.Title>
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
