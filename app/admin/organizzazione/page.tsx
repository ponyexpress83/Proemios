import type { Metadata } from "next";
import { Titolo, Nota } from "@/components/ui/primitivi";
import { Scheda, SchedaCorpo, SchedaTestata } from "@/components/ui/scheda";
import { Badge } from "@/components/ui/badge";
import { ImpostazioniAspetto } from "@/components/organizzazione/aspetto";
import { ElencoAgenzie } from "@/components/organizzazione/agenzie";
import { staffPerPagina } from "@/lib/auth/sessione";
import {
  elencaAgenzie,
  isStudio,
  organizzazioneCorrente,
  type OrganizzazionePerStudio,
} from "@/lib/dati/organizzazioni";

export const metadata: Metadata = {
  title: "Organizzazione",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaginaOrganizzazione() {
  const attore = await staffPerPagina("/admin/organizzazione", "organizzazione.vedi");
  const organizzazione = await organizzazioneCorrente(attore);

  // L'elenco delle altre organizzazioni esiste solo per lo studio: un'agenzia
  // non deve sapere quali altre agenzie ci sono, né che ce ne siano.
  let agenzie: OrganizzazionePerStudio[] = [];
  const studio = await isStudio(attore);
  if (studio) {
    try {
      agenzie = await elencaAgenzie(attore);
    } catch {
      // Manca `organizzazione.gestisci`: si vede la propria e basta.
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello={organizzazione.slug}
        sotto="Come si presenta il portale ai tuoi clienti, e chi ne fa parte."
      >
        {organizzazione.nome}
      </Titolo>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tono={organizzazione.tipo === "studio" ? "lime" : "viola"}>
          {organizzazione.tipo === "studio" ? "Studio" : "Agenzia"}
        </Badge>
        {organizzazione.proemiosInvisibile ? <Badge>Marchio nascosto</Badge> : null}
        {organizzazione.attiva ? null : <Badge tono="errore">Disattivata</Badge>}
      </div>

      <Scheda>
        <SchedaTestata
          titolo="Aspetto del portale"
          sotto="Colore, logo e mittente delle email. Le modifiche valgono per tutti i clienti di questa organizzazione."
        />
        <SchedaCorpo>
          <ImpostazioniAspetto iniziale={organizzazione.branding} />
        </SchedaCorpo>
      </Scheda>

      {studio ? (
        <Scheda>
          <SchedaTestata
            titolo="Agenzie"
            sotto="Ogni agenzia è un tenant separato: non vede i dati delle altre, e nemmeno che esistano."
          />
          <SchedaCorpo>
            <ElencoAgenzie agenzie={agenzie} />
          </SchedaCorpo>
        </Scheda>
      ) : (
        <Nota>
          Questa organizzazione è un&apos;agenzia: i suoi dati sono separati da quelli di chiunque
          altro.
        </Nota>
      )}
    </div>
  );
}
