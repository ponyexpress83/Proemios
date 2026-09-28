"use client";

import * as Toast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type TonoToast = "neutro" | "successo" | "errore";
type Messaggio = { id: number; titolo: string; descrizione?: string; tono: TonoToast };

const ContestoToast = createContext<((m: Omit<Messaggio, "id">) => void) | null>(null);

/**
 * Notifiche effimere. Radix gestisce la regione live (`role="status"`), quindi
 * un messaggio viene annunciato anche a chi non lo vede comparire.
 */
export function ProviderToast({ children }: { children: ReactNode }) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);

  const mostra = useCallback((m: Omit<Messaggio, "id">) => {
    setMessaggi((precedenti) => [...precedenti, { ...m, id: Date.now() + Math.random() }]);
  }, []);

  const toni: Record<TonoToast, string> = useMemo(
    () => ({
      neutro: "border-bordo-forte",
      successo: "border-successo/50",
      errore: "border-errore/50",
    }),
    [],
  );

  return (
    <ContestoToast.Provider value={mostra}>
      <Toast.Provider swipeDirection="right" duration={5000}>
        {children}
        {messaggi.map((m) => (
          <Toast.Root
            key={m.id}
            onOpenChange={(aperto) =>
              !aperto && setMessaggi((p) => p.filter((x) => x.id !== m.id))
            }
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-superficie-alta p-4 shadow-fluttuante",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
              toni[m.tono],
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Toast.Title className="text-sm font-medium text-testo">{m.titolo}</Toast.Title>
              {m.descrizione ? (
                <Toast.Description className="text-sm text-testo-tenue">
                  {m.descrizione}
                </Toast.Description>
              ) : null}
            </div>
            <Toast.Close
              aria-label="Chiudi"
              className="garbo rounded p-1 text-testo-tenue hover:text-testo"
            >
              <X className="size-3.5" aria-hidden />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed right-0 bottom-0 z-100 flex w-full max-w-sm flex-col gap-2 p-4" />
      </Toast.Provider>
    </ContestoToast.Provider>
  );
}

/** Restituisce la funzione per mostrare un toast. Richiede ProviderToast sopra. */
export function useToast() {
  const contesto = useContext(ContestoToast);
  if (!contesto) throw new Error("useToast richiede <ProviderToast> nell'albero.");
  return contesto;
}
