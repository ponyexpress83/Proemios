"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bottone } from "@/components/ui/bottone";
import { Avviso } from "@/components/ui/stati";

/**
 * Caricamento di un file dentro un progetto.
 *
 * Passa da una route e non da una server action: un manoscritto pesa decine
 * di megabyte e supererebbe il limite di corpo delle action, con un errore
 * che in pagina sembrerebbe un guasto qualunque.
 *
 * Il file viene mandato appena scelto, senza un secondo pulsante da premere:
 * l'unica cosa che si può fare dopo averlo scelto è caricarlo, e un passaggio
 * in più sarebbe solo un modo per dimenticarselo.
 */
export function CaricaFile({
  progettoId,
  etichetta = "Carica un file",
  descrizione,
}: {
  progettoId: string;
  etichetta?: string;
  descrizione?: string;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<string | null>(null);

  async function invia(file: File) {
    setInCorso(true);
    setErrore(null);
    setFatto(null);
    try {
      const corpo = new FormData();
      corpo.set("file", file);
      const risposta = await fetch(`/api/progetti/${progettoId}/file`, {
        method: "POST",
        body: corpo,
      });
      const dati = (await risposta.json()) as { ok?: boolean; errore?: string; nomeFile?: string };
      if (!risposta.ok || !dati.ok) {
        setErrore(dati.errore ?? "Caricamento non riuscito.");
        return;
      }
      setFatto(dati.nomeFile ?? file.name);
      // Il file appena caricato deve comparire nell'elenco e fra le versioni
      // da cui si può avviare una lavorazione: senza questo bisognerebbe
      // ricaricare la pagina a mano per vederlo.
      router.refresh();
    } catch {
      setErrore("Caricamento non riuscito: controlla la connessione e riprova.");
    } finally {
      setInCorso(false);
      if (campo.current) campo.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={campo}
        type="file"
        className="sr-only"
        accept=".docx,.pdf,.txt,.odt,.rtf,.md,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void invia(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Bottone
          variante="secondario"
          disabled={inCorso}
          onClick={() => campo.current?.click()}
        >
          {inCorso ? "Caricamento…" : etichetta}
        </Bottone>
        {descrizione && <span className="text-xs text-testo-tenue">{descrizione}</span>}
      </div>
      {fatto && <Avviso tono="successo">Caricato: {fatto}</Avviso>}
      {errore && <Avviso tono="errore">{errore}</Avviso>}
    </div>
  );
}
