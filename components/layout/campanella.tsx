"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { cn } from "@/lib/cn";
import { segnaComeLette } from "@/app/notifiche/azioni";
import type { NotificaDTO } from "@/lib/dati/notifiche";

/**
 * La campanella delle notifiche.
 *
 * L'elenco arriva già renderizzato dal server: aprire il pannello non fa una
 * richiesta. È una scelta consapevole — le notifiche sono poche e la
 * latenza di un fetch al clic si nota; il costo è che il numero si aggiorna
 * alla navigazione successiva, che per una campanella va benissimo.
 */
export function Campanella({ notifiche }: { notifiche: NotificaDTO[] }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [voci, setVoci] = useState(notifiche);
  const [, avvia] = useTransition();

  const nonLette = voci.filter((n) => !n.letta).length;

  function apri() {
    const prossimo = !aperto;
    setAperto(prossimo);
    if (!prossimo || nonLette === 0) return;

    avvia(async () => {
      const ids = voci.filter((n) => !n.letta).map((n) => n.id);
      await segnaComeLette({ ids });
      setVoci((precedenti) => precedenti.map((n) => ({ ...n, letta: true })));
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={apri}
        aria-expanded={aperto}
        aria-label={
          nonLette > 0 ? `Notifiche, ${nonLette} da leggere` : "Notifiche, nessuna da leggere"
        }
        className="garbo text-testo-attenuato hover:bg-superficie hover:text-testo relative grid size-9 place-items-center rounded-md"
      >
        <Bell className="size-4" aria-hidden />
        {nonLette > 0 ? (
          <span className="bg-lime text-fondo cifre absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[0.625rem] leading-4 font-semibold">
            {nonLette > 9 ? "9+" : nonLette}
          </span>
        ) : null}
      </button>

      {aperto ? (
        <div
          role="region"
          aria-label="Notifiche"
          className="border-bordo bg-superficie-alta shadow-sollevata absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border p-2"
        >
          {voci.length === 0 ? (
            <p className="text-testo-tenue p-4 text-sm">Non c&apos;è niente di nuovo.</p>
          ) : (
            <ul className="flex flex-col">
              {voci.map((n) => (
                <li key={n.id}>
                  <Link
                    href={(n.percorso ?? "/") as Route}
                    onClick={() => setAperto(false)}
                    className={cn(
                      "garbo hover:bg-superficie-viva block rounded-md px-3 py-2.5",
                      !n.letta && "bg-viola/8",
                    )}
                  >
                    <span className="text-testo block text-sm font-medium">{n.titolo}</span>
                    {n.corpo ? (
                      <span className="text-testo-tenue mt-0.5 block text-xs leading-relaxed">
                        {n.corpo}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
