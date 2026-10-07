import { Collegamento } from "@/components/sito/collegamento";
import { SegnoMargine } from "@/components/sito/segni";

/**
 * Come funziona: cinque passaggi in sequenza — qui i numeri hanno senso,
 * perché l'ordine è il contenuto — e sotto le tre garanzie, come note a
 * margine con il segno del correttore.
 */
const PASSI: [string, string][] = [
  ["Raccontaci il progetto", "Dal testo, dall'idea e da quello che ti aspetti."],
  ["Costruiamo il percorso", "Attività, consegne e preventivo, scritti prima di iniziare."],
  ["Lavoriamo insieme", "Un editor sul tuo testo, una fase alla volta."],
  ["Approvi ogni fase", "Leggi, commenti e confermi. Niente passa senza il tuo sì."],
  ["Ricevi il libro pronto", "I file finali, nei formati concordati, nell'area autore."],
];

const GARANZIE: { titolo: string; testo: string; href: string; azione: string }[] = [
  {
    titolo: "I diritti restano tuoi",
    testo: "Il testo è tuo prima, durante e dopo. Lo dice il contratto, non una pagina web.",
    href: "/termini",
    azione: "Leggi i termini",
  },
  {
    titolo: "Prezzi chiari prima di iniziare",
    testo: "La stima la vedi subito; il preventivo che firmi è quello che paghi.",
    href: "/preventivo",
    azione: "Calcola il preventivo",
  },
  {
    titolo: "Approvi tu ogni fase",
    testo: "Nessuna correzione arriva al libro senza che tu l'abbia letta.",
    href: "/come-funziona",
    azione: "Come funziona",
  },
];

/** `qui`: percorso della pagina corrente, per non linkare la pagina a sé stessa. */
export function Tappe({ qui }: { qui?: string } = {}) {
  return (
    <div>
      <ol className="tappe grid gap-8 lg:grid-cols-5 lg:gap-6">
        {PASSI.map(([titolo, testo], i) => (
          <li key={titolo} className="tappa relative flex gap-4 lg:block">
            <span className="tappa-numero flex size-9 shrink-0 items-center justify-center rounded-pillola border border-inchiostro font-serif text-t-base text-inchiostro lg:mb-4">
              {i + 1}
            </span>
            <div>
              <h3 className="font-serif text-t-md text-inchiostro">{titolo}</h3>
              <p className="mt-1 text-t-sm text-grafite">{testo}</p>
            </div>
          </li>
        ))}
      </ol>

      <ul className="mt-12 grid gap-8 border-t border-filetto pt-10 md:grid-cols-3">
        {GARANZIE.map((g) => (
          <li key={g.titolo} className="relative pl-6">
            <SegnoMargine className="absolute top-0 left-0 h-10 w-3.5" colore="rosso" />
            <h3 className="font-serif text-t-md text-inchiostro">{g.titolo}</h3>
            <p className="mt-1 text-t-sm text-grafite">{g.testo}</p>
            {g.href !== qui && (
              <Collegamento href={g.href} className="mt-3 text-t-sm">
                {g.azione}
              </Collegamento>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
