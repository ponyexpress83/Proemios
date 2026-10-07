import Link from "next/link";
import type { Route } from "next";
import { SERVIZI_PER_AREA, type PrezzoPubblico } from "@/config/catalogo";
import { euro, tariffaParola } from "@/lib/format";

/**
 * I servizi composti come l'indice di un libro: titolo a sinistra, puntini di
 * guida, a destra il «numero di pagina» — qui la tariffa, o «su preventivo».
 * Ogni voce è un link alla sua pagina; i gruppi sono le parti del catalogo.
 *
 * La tariffa al posto di «Scopri →»: in un indice la cosa a destra è
 * un'informazione, non un invito, e qui l'informazione che conta è il prezzo.
 */
function rigaPrezzo(p: PrezzoPubblico): string {
  switch (p.tipo) {
    case "forfait":
      return euro(p.importo);
    case "fascia":
      return `da ${euro(p.da)}`;
    case "a-parola":
      return `da ${tariffaParola(p.da, p.da)}`;
    case "preventivo":
      return "su preventivo";
  }
}

export function IndiceServizi({ tutte = false }: { tutte?: boolean }) {
  /** In home tutte le parti tranne B2B, che ha la sua fascia; in /servizi tutte. */
  const parti = tutte ? SERVIZI_PER_AREA : SERVIZI_PER_AREA.filter((a) => a.area !== "b2b");
  return (
    <div className="columns-1 gap-x-12 md:columns-2">
      {parti.map((parte) => (
        <section key={parte.area} className="mb-8 break-inside-avoid" aria-labelledby={`indice-${parte.area}`}>
          <h3 id={`indice-${parte.area}`} className="font-serif text-t-lg text-inchiostro">
            {parte.nome}
          </h3>
          <p className="mt-1 text-t-sm text-grafite">{parte.sommario}</p>
          <ul className="mt-3">
            {parte.servizi.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/servizi/${s.slug}` as Route}
                  className="indice-voce group flex min-h-11 items-baseline gap-2 rounded-campo py-1.5 text-t-sm text-inchiostro"
                >
                  <span className="sottolinea-matita group-hover:text-blu-matita">{s.nome}</span>
                  <span className="indice-guida" aria-hidden="true" />
                  <span className="tabellare shrink-0 text-grafite">{rigaPrezzo(s.prezzo)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
