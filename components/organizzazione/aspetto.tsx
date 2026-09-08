"use client";

import { useState, useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { Campo, Input, AreaTesto } from "@/components/ui/campi";
import { Avviso } from "@/components/ui/stati";
import { Nota } from "@/components/ui/primitivi";
import { salvaBranding } from "@/app/admin/organizzazione/azioni";
import type { Branding } from "@/lib/branding";

/**
 * Impostazioni di aspetto per il portale white label.
 *
 * L'anteprima usa il colore digitato solo se è un esadecimale valido, e lo
 * applica come `background` di un quadratino — non come CSS grezzo. Il valore
 * passa comunque dalla validazione del server prima di essere salvato: quella
 * qui è comodità, non sicurezza.
 */
export function ImpostazioniAspetto({ iniziale }: { iniziale: Branding | null }) {
  const [branding, setBranding] = useState<Branding>(iniziale ?? {});
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const [inCorso, avvia] = useTransition();

  const coloreValido = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    branding.coloreIdentita ?? "",
  );

  function campo<K extends keyof Branding>(chiave: K) {
    return (valore: string) => setBranding((b) => ({ ...b, [chiave]: valore }));
  }

  function salva() {
    setEsito(null);
    avvia(async () => {
      const r = await salvaBranding(branding);
      setEsito({ ok: r.ok, testo: r.ok ? (r.messaggio ?? "Salvato.") : r.messaggio });
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {esito ? (
        <Avviso tono={esito.ok ? "successo" : "errore"} titolo={esito.ok ? "Fatto" : "Non salvato"}>
          {esito.testo}
        </Avviso>
      ) : null}

      <Campo
        id="nome-visualizzato"
        label="Nome visualizzato"
        hint="Il nome che i tuoi clienti vedono nel portale."
      >
        {(props) => (
          <Input
            {...props}
            value={branding.nomeVisualizzato ?? ""}
            onChange={(e) => campo("nomeVisualizzato")(e.target.value)}
          />
        )}
      </Campo>

      <Campo
        id="colore"
        label="Colore d'identità"
        hint="Esadecimale, per esempio #6c4bff. Sostituisce il viola nelle superfici del portale."
      >
        {(props) => (
          <div className="flex items-center gap-3">
            <Input
              {...props}
              className="max-w-40"
              placeholder="#6c4bff"
              value={branding.coloreIdentita ?? ""}
              onChange={(e) => campo("coloreIdentita")(e.target.value)}
            />
            <span
              aria-hidden
              className="border-bordo size-9 shrink-0 rounded-md border"
              style={coloreValido ? { background: branding.coloreIdentita } : undefined}
            />
            {!coloreValido && branding.coloreIdentita ? <Nota>Non è un colore valido.</Nota> : null}
          </div>
        )}
      </Campo>

      <Campo
        id="logo"
        label="Logo"
        hint="Indirizzo https di un'immagine. Deve essere https: un logo servito in chiaro fa tracciare i tuoi clienti da terzi."
      >
        {(props) => (
          <Input
            {...props}
            placeholder="https://cdn.tuodominio.it/logo.svg"
            value={branding.logoUrl ?? ""}
            onChange={(e) => campo("logoUrl")(e.target.value)}
          />
        )}
      </Campo>

      <Campo
        id="dominio"
        label="Dominio del portale"
        hint="Facoltativo. Va configurato anche sul DNS."
      >
        {(props) => (
          <Input
            {...props}
            placeholder="portale.tuodominio.it"
            value={branding.dominio ?? ""}
            onChange={(e) => campo("dominio")(e.target.value)}
          />
        )}
      </Campo>

      <Campo
        id="mittente"
        label="Mittente delle email"
        hint="Il dominio dev'essere verificato sul provider di posta, altrimenti le email non partono."
      >
        {(props) => (
          <Input
            {...props}
            placeholder="ciao@tuodominio.it"
            value={branding.emailMittente ?? ""}
            onChange={(e) => campo("emailMittente")(e.target.value)}
          />
        )}
      </Campo>

      <Campo id="firma" label="Firma delle email">
        {(props) => (
          <AreaTesto
            {...props}
            value={branding.firmaEmail ?? ""}
            onChange={(e) => campo("firmaEmail")(e.target.value)}
          />
        )}
      </Campo>

      <div>
        <Bottone disabled={inCorso} onClick={salva}>
          {inCorso ? "Salvo…" : "Salva l'aspetto"}
        </Bottone>
      </div>
    </div>
  );
}
