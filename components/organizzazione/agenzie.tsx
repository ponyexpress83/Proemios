"use client";

import { useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, Consenso } from "@/components/ui/campi";
import { Badge } from "@/components/ui/badge";
import { Avviso } from "@/components/ui/stati";
import { Nota } from "@/components/ui/primitivi";
import { dataEstesa } from "@/lib/format";
import { attivaAgenzia, nuovaAgenzia } from "@/app/admin/organizzazione/azioni";
import type { OrganizzazionePerStudio } from "@/lib/dati/organizzazioni";

/**
 * Gestione delle agenzie, visibile solo allo studio.
 *
 * Creare un'agenzia non crea persone: un tenant vuoto è il punto di partenza, e
 * le persone si invitano con il flusso degli inviti, che manda un magic link e
 * traccia chi ha invitato chi.
 */
export function ElencoAgenzie({ agenzie }: { agenzie: OrganizzazionePerStudio[] }) {
  const [slug, setSlug] = useState("");
  const [nome, setNome] = useState("");
  const [invisibile, setInvisibile] = useState(true);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  function crea() {
    setEsito(null);
    avvia(async () => {
      const r = await nuovaAgenzia({ slug, nome, proemiosInvisibile: invisibile });
      setEsito({ ok: r.ok, testo: r.ok ? (r.messaggio ?? "Creata.") : r.messaggio });
      if (r.ok) {
        setSlug("");
        setNome("");
      }
    });
  }

  function cambia(organizationId: string, attiva: boolean) {
    setEsito(null);
    avvia(async () => {
      const r = await attivaAgenzia({ organizationId, attiva });
      setEsito({ ok: r.ok, testo: r.ok ? (r.messaggio ?? "Fatto.") : r.messaggio });
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {esito ? (
        <Avviso
          tono={esito.ok ? "successo" : "errore"}
          titolo={esito.ok ? "Fatto" : "Non riuscito"}
        >
          {esito.testo}
        </Avviso>
      ) : null}

      <ul className="flex flex-col gap-2">
        {agenzie.length === 0 ? (
          <Nota>Nessuna agenzia. Creane una qui sotto.</Nota>
        ) : (
          agenzie.map((a) => (
            <li
              key={a.id}
              className="border-bordo bg-superficie flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-testo font-semibold">{a.nome}</span>
                  <span className="cifre text-testo-tenue text-xs">{a.slug}</span>
                  {a.proemiosInvisibile ? <Badge tono="viola">Marchio nascosto</Badge> : null}
                  {a.attiva ? null : <Badge tono="errore">Disattivata</Badge>}
                </div>
                <span className="text-testo-tenue text-xs">
                  Dal {dataEstesa(a.createdAt)}
                  {a.ndaFirmatoAt
                    ? ` · NDA firmato il ${dataEstesa(a.ndaFirmatoAt)}`
                    : " · NDA non firmato"}
                </span>
              </div>
              <Bottone
                misura="piccola"
                variante={a.attiva ? "distruttivo" : "secondario"}
                disabled={inCorso}
                onClick={() => cambia(a.id, !a.attiva)}
              >
                {a.attiva ? "Disattiva" : "Riattiva"}
              </Bottone>
            </li>
          ))
        )}
      </ul>

      <div className="border-bordo flex flex-col gap-4 rounded-lg border p-5">
        <h3 className="text-testo text-base font-semibold">Nuova agenzia</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="nome-agenzia" label="Nome">
            {(props) => <Input {...props} value={nome} onChange={(e) => setNome(e.target.value)} />}
          </Campo>
          <Campo id="slug-agenzia" label="Slug" hint="Minuscole, cifre e trattini.">
            {(props) => (
              <Input
                {...props}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="edizioni-aurora"
              />
            )}
          </Campo>
        </div>
        <Consenso id="invisibile" name="invisibile" checked={invisibile} onChange={setInvisibile}>
          <strong className="text-testo">Marchio Proemios nascosto.</strong> L&apos;agenzia e i suoi
          clienti non vedono mai il nostro nome, nemmeno nel titolo delle pagine o nell&apos;oggetto
          delle email.
        </Consenso>
        <div>
          <Bottone disabled={inCorso || !nome.trim() || !slug.trim()} onClick={crea}>
            Crea l&apos;agenzia
          </Bottone>
        </div>
      </div>
    </div>
  );
}
