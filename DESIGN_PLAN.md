# Proemios — Design del sito pubblico

Il sito pubblico riprende la direzione approvata «Editorial technology with depth»: una presenza editoriale calda, con profondità tattile e interazioni leggere.

> **Ambito.** Questo documento riguarda il **sito pubblico**, cioè tutto ciò che
> sta dentro il route group `app/(sito)` e quindi dentro `.proemios-public`.
> Le aree riservate — back-office, portale cliente, redazione, accesso — hanno
> un sistema proprio, scuro, descritto in `docs/DESIGN_SYSTEM.md`. I due
> convivono di proposito: chi compra legge una presenza editoriale, chi lavora
> usa un'interfaccia da strumento.

## Identità condivisa

- Avorio #FAF8F5, corallo #F16650, navy #131936, prugna #382138.
- Stati lilla, salvia e pesca; card bianche arrotondate, ombre morbide.
- Titoli serif P052 e interfaccia Nimbus Sans, serviti localmente.
- Logo libro aperto, CTA corallo, focus visibile e link accessibili.

## Componenti e pagine

Il guscio pubblico è montato da `app/(sito)/layout.tsx` tramite `SiteChrome`,
non dal layout radice: le aree riservate non devono portarsi dietro il menu
commerciale.

`components/editorial` contiene il sistema condiviso: navigazione, footer, scene a livelli, timeline, slider prima/dopo, percorsi e sezioni riusabili. `lib/editorial-content.ts` contiene i testi pubblici; `app/editorial.css` applica il tema dentro `.proemios-public`.

Le pagine operative usano il configuratore, il caricamento manoscritto e i moduli originali. Tariffe e calcoli restano in `config/pricing.ts` e `lib/pricing.ts`; API, database, pagamenti, attribution e protezione del backoffice rimangono quelli del progetto.

`/accedi` è l'accesso reale: autenticazione con sessione in database, e dopo
l'accesso porta all'area che spetta alla persona — `/area` per gli autori,
`/admin` o `/redazione` per lo staff. Vive fuori da `app/(sito)`, con un layout
proprio, perché non è una pagina commerciale. Il portale cliente e il
back-office esistono e conservano la propria interfaccia.

## Mobile e movimento

Hero impilata, percorsi a scorrimento orizzontale, timeline verticale, servizi a fisarmonica. Scene in CSS 3D e immagini WebP ottimizzate, senza WebGL o video in hero. Le animazioni rispettano `prefers-reduced-motion`.

## Contenuti verificabili

Le schede del team e le testimonianze restano segnaposto dichiarati fino a disponibilità di profili e contenuti verificati. Nessun cliente, premio, risultato o prezzo inventato. Le pagine legali usano la configurazione societaria esistente.

## Pagine non ancora portate nella nuova identità

Catalogo servizi, percorsi, note legali e strumenti usano ancora i componenti
del design system applicativo. Dentro `.proemios-public` ricevono la classe
`legacy-content` e i token di quel sistema sono rimappati sul chiaro in
`app/editorial.css`: restano leggibili e coerenti con l'avorio, senza essere
ancora ridisegnati. Il rimappaggio è necessario, non cosmetico — `--color-testo`
è un bianco caldo, e su avorio dava 1,02:1, cioè testo invisibile.

Due insiemi di contenuti convivono su `/servizi` e `/percorsi`: il catalogo di
progetto (`config/catalogo.ts`, `config/percorsi.ts`, con le tariffe) e le
pagine di atterraggio editoriali (`lib/editorial-content.ts`). Entrambe sono
servite, perché testata e piè di pagina puntano alle seconde; dove gli slug si
sovrappongono vince il catalogo, che ha il prezzo. **Resta una decisione
commerciale aperta**: se consolidare i due insiemi in uno.
