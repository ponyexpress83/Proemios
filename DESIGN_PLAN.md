# Proemios — Design del sito pubblico

Il sito pubblico riprende la direzione approvata «Editorial technology with depth»: una presenza editoriale calda, con profondità tattile e interazioni leggere.

## Identità condivisa

- Avorio #FAF8F5, corallo #F16650, navy #131936, prugna #382138.
- Stati lilla, salvia e pesca; card bianche arrotondate, ombre morbide.
- Titoli serif P052 e interfaccia Nimbus Sans, serviti localmente.
- Logo libro aperto, CTA corallo, focus visibile e link accessibili.

## Componenti e pagine

`components/editorial` contiene il sistema condiviso: navigazione, footer, scene a livelli, timeline, slider prima/dopo, percorsi e sezioni riusabili. `lib/editorial-content.ts` contiene i testi pubblici; `app/editorial.css` applica il tema dentro `.proemios-public`.

Le pagine operative usano il configuratore, il caricamento manoscritto e i moduli originali. Tariffe e calcoli restano in `config/pricing.ts` e `lib/pricing.ts`; API, database, pagamenti, attribution e protezione del backoffice rimangono quelli del progetto.

`/accedi` introduce una demo interattiva dello spazio autore in `/area-autore`, distinta dal backoffice protetto `/admin`. Login dimostrativo, messaggi, download di file di esempio e approvazioni funzionano senza account reali, database clienti o transazioni. Lo stato è conservato nella scheda del browser e si cancella con l’uscita o il ripristino della demo. I mockup italiani condividono palette, tipografia e componenti con questo spazio. Il backoffice conserva la propria UI.

## Mobile e movimento

Hero impilata, percorsi a scorrimento orizzontale, timeline verticale, servizi a fisarmonica. Scene in CSS 3D e immagini WebP ottimizzate, senza WebGL o video in hero. Le animazioni rispettano `prefers-reduced-motion`.

## Contenuti verificabili

Le schede del team e le testimonianze restano segnaposto dichiarati fino a disponibilità di profili e contenuti verificati. Nessun cliente, premio, risultato o prezzo inventato. Le pagine legali usano la configurazione societaria esistente.
