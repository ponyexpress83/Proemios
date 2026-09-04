import type { Metadata } from "next";
import { FolderOpen } from "lucide-react";
import { Gabbia, Titolo } from "@/components/ui/primitivi";
import { StatoVuoto } from "@/components/ui/stati";
import { BottoneLink } from "@/components/ui/bottone";
import { attorePerPagina } from "@/lib/auth/sessione";

export const metadata: Metadata = { title: "I miei progetti" };
export const dynamic = "force-dynamic";

export default async function AreaCliente() {
  const attore = await attorePerPagina("/area");

  return (
    <Gabbia className="py-12">
      <Titolo
        livello={1}
        occhiello="Area riservata"
        sotto="Qui trovi i tuoi progetti, i file e le richieste che aspettano una tua risposta."
      >
        Ciao{attore.nome ? `, ${attore.nome.split(" ")[0]}` : ""}.
      </Titolo>

      <div className="mt-10">
        {/*
          I progetti compaiono qui quando ce ne sono. La lettura passa dal
          livello dati, che filtra per proprietà: un cliente vede i propri e
          basta. La schermata completa (avanzamento, milestone, file,
          approvazioni) arriva con la Fase 3.
        */}
        <StatoVuoto
          icona={<FolderOpen className="size-5" aria-hidden />}
          titolo="Nessun progetto attivo"
          descrizione="Quando apriamo un progetto per te lo trovi qui, con lo stato di avanzamento, i file e le richieste che aspettano una tua risposta."
          azione={
            <BottoneLink href="/preventivo" variante="identita">
              Fai un preventivo
            </BottoneLink>
          }
        />
      </div>
    </Gabbia>
  );
}
