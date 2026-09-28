import type { Metadata } from "next";
import { Gabbia, Titolo, Dato } from "@/components/ui/primitivi";
import { Scheda, SchedaTestata, SchedaCorpo } from "@/components/ui/scheda";
import { StatoVuoto } from "@/components/ui/stati";
import { attorePerPagina } from "@/lib/auth/sessione";
import { sessioniProprie } from "@/lib/dati/utenti";
import { profiloProprio } from "@/lib/dto/utente";
import { ETICHETTE_RUOLO } from "@/lib/auth/ruoli";
import { BottoneRevocaSessioni } from "@/components/auth/revoca-sessioni";
import { dataEstesa } from "@/lib/format";

export const metadata: Metadata = { title: "Profilo e accessi" };
export const dynamic = "force-dynamic";

export default async function PaginaProfilo() {
  const attore = await attorePerPagina("/area/profilo");
  const profilo = profiloProprio(attore);
  const sessioni = await sessioniProprie(attore);

  return (
    <Gabbia className="py-12">
      <Titolo livello={1} occhiello="Account">
        Profilo e accessi
      </Titolo>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <Scheda>
          <SchedaTestata titolo="I tuoi dati" />
          <SchedaCorpo className="flex flex-col gap-5">
            <Dato etichetta="Nome">{profilo.nome ?? "—"}</Dato>
            <Dato etichetta="Email">{profilo.email}</Dato>
            <Dato etichetta="Ruolo">{ETICHETTE_RUOLO[profilo.ruolo]}</Dato>
            <p className="text-sm leading-relaxed text-testo-tenue">
              Per cambiare nome o indirizzo email scrivi al tuo referente: la modifica passa da
              noi perché l&rsquo;indirizzo è anche la tua credenziale di accesso.
            </p>
          </SchedaCorpo>
        </Scheda>

        <Scheda>
          <SchedaTestata
            titolo="Accessi attivi"
            sotto="I dispositivi da cui risulti collegato."
            azione={sessioni.length > 1 ? <BottoneRevocaSessioni /> : undefined}
          />
          <SchedaCorpo>
            {sessioni.length === 0 ? (
              <StatoVuoto titolo="Nessun accesso registrato" />
            ) : (
              <ul className="flex flex-col divide-y divide-bordo">
                {sessioni.map((s) => (
                  <li key={s.token} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <span className="cifre text-sm text-testo">{s.token}</span>
                    <span className="text-xs text-testo-tenue">
                      Dal {dataEstesa(s.creataAt)} · scade il {dataEstesa(s.scadeAt)}
                    </span>
                    {s.userAgent ? (
                      <span className="truncate text-xs text-testo-tenue">{s.userAgent}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </SchedaCorpo>
        </Scheda>
      </div>
    </Gabbia>
  );
}
