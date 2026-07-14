import { Container } from "@/components/ui/Container";

export interface LegalSection {
  titolo: string;
  paragrafi: string[];
}

/** Impaginazione condivisa per le pagine legali (privacy, termini). */
export function LegalDoc({
  titolo,
  aggiornamento,
  intro,
  sezioni,
}: {
  titolo: string;
  aggiornamento: string;
  intro: string;
  sezioni: LegalSection[];
}) {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-prose">
        <h1 className="font-display text-inchiostro text-4xl font-medium sm:text-5xl">{titolo}</h1>
        <p className="text-inchiostro-40 mt-3 text-sm">Ultimo aggiornamento: {aggiornamento}</p>
        <div className="border-linea bg-carta-2 text-inchiostro-60 mt-6 rounded-lg border border-dashed p-4 text-sm">
          TODO — Testo di esempio. Questa pagina è una struttura da completare con i contenuti
          legali definitivi, redatti o validati da un consulente.
        </div>
        <p className="text-inchiostro-80 mt-8 leading-relaxed">{intro}</p>

        <div className="mt-10 space-y-9">
          {sezioni.map((s, i) => (
            <section key={i}>
              <h2 className="font-display text-inchiostro text-xl font-medium">
                {i + 1}. {s.titolo}
              </h2>
              {s.paragrafi.map((p, j) => (
                <p key={j} className="text-inchiostro-60 mt-3 leading-relaxed">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </Container>
  );
}
