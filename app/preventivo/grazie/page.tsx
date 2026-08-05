import type { Metadata } from "next";
import { Gabbia, Filetto } from "@/components/ui/primitivi";
import { BottoneLink } from "@/components/ui/bottone";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Acconto ricevuto",
  descrizione: "Conferma dell'acconto per il tuo progetto editoriale.",
  path: "/preventivo/grazie",
  noindex: true,
});

const PASSI = [
  "Entro un giorno lavorativo ti scriviamo per fissare la call di avvio.",
  "Ci mandi i materiali definitivi: testo, immagini, riferimenti.",
  "Partiamo. Ogni consegna passa da una tua approvazione prima di proseguire.",
];

export default function GraziePage() {
  return (
    <div className="bg-notte text-carta su-notte py-20 sm:py-28">
      <Gabbia>
        <div className="mx-auto max-w-xl">
          <p className="apparato text-ottone">Acconto ricevuto</p>
          <h1 className="font-display mt-5 text-[2.3rem] leading-[1.08] font-medium sm:text-[3rem]">
            La data è tua.
          </h1>
          <Filetto className="mt-7" tono="notte" />
          <p className="prosa-grande text-carta/75 mt-7">
            Abbiamo registrato il pagamento e ti è arrivata una email di conferma. Il tuo progetto è
            entrato nel piano di lavorazione.
          </p>

          <ol className="mt-10 space-y-4">
            {PASSI.map((p, i) => (
              <li key={i} className="flex gap-4">
                <span className="cifre text-ottone shrink-0">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-lettura text-carta/80 leading-relaxed">{p}</span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <BottoneLink href="/" variante="chiaro" misura="grande">
              Torna alla home
            </BottoneLink>
            <BottoneLink href="/contatti" variante="secondarioNotte" misura="grande">
              Scrivici
            </BottoneLink>
          </div>
        </div>
      </Gabbia>
    </div>
  );
}
