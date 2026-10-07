import { Collegamento } from "@/components/sito/collegamento";
import { PulsanteLink } from "@/components/sito/pulsante";
import { Contenitore, Filetto, Sezione } from "@/components/sito/sezione";
import { ElencoIncluso } from "@/components/sezioni/elenchi";
import { FasciaCta, Passi } from "@/components/marketing/blocchi";
import { services, paths, articles } from "@/lib/editorial-content";

/**
 * Le pagine di atterraggio con slug propri — tre servizi, quattro percorsi,
 * tre guide — che la vecchia identità editoriale aveva introdotto. Gli URL
 * restano (nessun link deve rompersi): cambia il modo di comporli, che ora è
 * lo stesso del resto del sito. I testi vivono in `lib/editorial-content.ts`.
 */
export function SchedaServizioEditoriale({ slug }: { slug: string }) {
  const s = services.find((x) => x.slug === slug);
  if (!s) return null;
  return (
    <>
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <p className="maiuscoletto text-t-sm text-grafite">{s.group}</p>
          <h1 className="mt-2 max-w-giustezza font-serif text-t-display text-balance text-inchiostro">{s.title}</h1>
          <p className="mt-4 max-w-giustezza font-serif text-t-md text-inchiostro">{s.lead}</p>
          <p className="mt-4 max-w-giustezza text-t-md text-grafite">{s.description}</p>
          <div className="mt-8">
            <PulsanteLink href={`/preventivo?servizio=${s.slug}`} variante="primario">
              Calcola il preventivo
            </PulsanteLink>
          </div>
        </Contenitore>
      </Sezione>
      <Sezione filetto>
        <Contenitore>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="font-serif text-t-xl text-inchiostro">Cosa comprende</h2>
              <ElencoIncluso voci={s.includes} className="mt-6" />
              <p className="mt-6 text-t-sm text-grafite">{s.note}</p>
            </div>
            <dl className="space-y-6">
              <div>
                <dt className="maiuscoletto text-t-sm text-grafite">Da cosa partiamo</dt>
                <dd className="mt-1 text-t-base text-inchiostro">{s.needs}</dd>
              </div>
              <div>
                <dt className="maiuscoletto text-t-sm text-grafite">Cosa ricevi</dt>
                <dd className="mt-1 text-t-base text-inchiostro">{s.result}</dd>
              </div>
            </dl>
          </div>
        </Contenitore>
      </Sezione>
      <FasciaCta ctaPrimaria={{ href: `/preventivo?servizio=${s.slug}`, testo: "Calcola il preventivo" }} />
    </>
  );
}

export function SchedaPercorsoEditoriale({ slug }: { slug: string }) {
  const p = paths.find((x) => x.slug === slug);
  if (!p) return null;
  return (
    <>
      <Sezione className="pt-10 lg:pt-14">
        <Contenitore>
          <p className="maiuscoletto text-t-sm text-grafite">Percorso</p>
          <h1 className="mt-2 max-w-giustezza font-serif text-t-display text-balance text-inchiostro">{p.title}</h1>
          <p className="mt-4 max-w-giustezza font-serif text-t-md text-inchiostro">{p.short}</p>
          <p className="mt-4 max-w-giustezza text-t-md text-grafite">{p.description}</p>
          <div className="mt-8">
            <PulsanteLink href={`/preventivo?percorso=${p.slug}`} variante="primario">
              Calcola il preventivo
            </PulsanteLink>
          </div>
        </Contenitore>
      </Sezione>
      <Sezione filetto>
        <Contenitore>
          <h2 className="font-serif text-t-xl text-inchiostro">Le tappe</h2>
          <p className="mt-3 max-w-giustezza text-t-base text-grafite">
            Una traccia: il piano effettivo viene adattato al progetto e condiviso prima dell&rsquo;avvio.
          </p>
          <Passi
            className="mt-8"
            passi={p.steps.map((titolo) => ({ titolo, descrizione: "" }))}
          />
        </Contenitore>
      </Sezione>
      <FasciaCta ctaPrimaria={{ href: `/preventivo?percorso=${p.slug}`, testo: "Calcola il preventivo" }} />
    </>
  );
}

export function ArticoloEditoriale({ slug }: { slug: string }) {
  const a = articles.find((x) => x.slug === slug);
  if (!a) return null;
  return (
    <Sezione className="pt-10 lg:pt-14">
      <Contenitore stretto>
        <Collegamento href="/blog" className="text-t-sm">
          ← Tutte le guide
        </Collegamento>
        <p className="maiuscoletto mt-8 text-t-sm text-grafite">{a.tag}</p>
        <h1 className="mt-2 font-serif text-t-display text-balance text-inchiostro">{a.title}</h1>
        <p className="mt-4 text-t-md text-grafite">{a.summary}</p>
        <Filetto className="my-8" />
        <div className="space-y-5 font-serif text-t-base text-inchiostro">
          {a.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <p className="mt-8 text-t-sm text-grafite">
          Le attività e le consegne del singolo progetto vengono sempre definite nella proposta
          personalizzata.
        </p>
      </Contenitore>
    </Sezione>
  );
}
