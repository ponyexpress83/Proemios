# Proemios — debug grafico, UX, SEO usability, AEO e GEO

**Sito:** [proemios.vercel.app](https://proemios.vercel.app/) · **Data:** 6 ottobre 2026  
**Ambito:** sito pubblico in versione *demo*. Questo documento approfondisce il [primo audit tecnico e funzionale](/home/ubuntu/proemios-audit/REPORT_AUDIT_PROEMIOS.md), senza modificarne il sito. Non ho accesso al codice, a Search Console o ai dati delle conversioni.

## Giudizio sintetico

**La direzione grafica è buona, ma l’architettura informativa non è ancora pronta a sostenere la promessa commerciale né la scoperta tramite ricerca.** La tipografia editoriale e il colore corallo rendono il marchio riconoscibile; le CTA primarie sono visibili anche su mobile. I problemi maggiori sono **pre-lancio**: crawler bloccati; 9 pagine in sitemap senza collegamenti interni HTML; canonical e dati strutturati con host di anteprima protetto; guide troppo brevi per rispondere in modo completo a domande reali; casi studio diretti non coerenti con la pagina indice; un servizio con fascia di prezzo che porta a un configuratore dove quel servizio non compare.

> **Scelta preliminare:** se `proemios.vercel.app` deve rimanere una demo, mantenere il blocco dell’indicizzazione e togliere/allineare segnali pubblici incoerenti. Se deve diventare il sito di produzione, decidere prima il dominio canonico e poi aprire ai crawler **solo le pagine verificate**. Non raccomando di rimuovere indiscriminatamente `Disallow: /` su una demo.

| Priorità | Evidenza principale | Intervento |
| --- | --- | --- |
| **P0 se si lancia** | `robots.txt` blocca Googlebot, Bingbot e OAI-SearchBot; canonical e sitemap puntano a host diversi/protetti | Una sola policy di dominio, indicizzazione e sitemap |
| **P1** | 9 URL della sitemap senza link interni dalle 40 pagine; tre casi studio non raggiungibili dall’indice | Collegarli se pubblicabili; altrimenti rimuoverli o escluderli dall’indicizzazione |
| **P1** | La pagina Casi studio dice “in preparazione”, ma tre URL diretti presentano progetti, risultati e un virgolettato | Verificare e uniformare stato/attribuzione dei casi |
| **P1** | `/servizi/valutazione-editoriale` promette 149–349 €, ma il percorso `?servizio=valutazione-editoriale` non offre la valutazione tra i servizi del configuratore | Preservare l’intento oppure inviare a un flusso dedicato |
| **P2** | Guide di 94–107 parole di articolo, senza autore/data né collegamenti contestuali | Rendere le risposte più utili e verificabili, non solo più lunghe |
| **P2** | 39/40 pagine senza immagine Open Graph, 7 descrizioni identiche | Anteprime e snippet specifici per pagina |
| **P2** | Home mobile molto lunga; diagramma a 320 px con etichette da 10,24 px | Ridurre ripetizioni e dare una modalità lineare mobile |

## 1. Debug grafico e UX

### Cosa funziona

- **Identità visiva:** palette panna/blu notte/corallo e titoli serif coerenti; contrasto di gerarchia fra titolo, testo e pulsante principale generalmente chiaro. La [prima schermata mobile](/home/ubuntu/proemios-audit/mobile-home-settled.png) contiene proposta, due CTA e segnali di fiducia entro il primo viewport da 390 × 844 px.
- **Servizi organizzati:** l’[accordion mobile](/home/ubuntu/proemios-audit/focus/mobile-home-section-04.png) raggruppa Revisione, Scrittura, Design, Pubblicazione e Promozione senza overflow orizzontale. I passaggi del preventivo indicano progressione e opzioni selezionate.
- **Prove visive oneste:** il confronto testo originale/revisionato dichiara che è dimostrativo; la home non spaccia i segnaposto per testimonianze verificate.

### G1 — Troppa estensione e ripetizione nella home — P2

La home comprende **11 sezioni** e misura circa **11.538 px a 390 px**; lo stesso mockup dashboard è usato **quattro volte**. La sezione del team mostra una foto editoriale e quattro ruoli con iniziali, non persone identificabili, pur dicendo “Lavori con persone”. Le tre testimonianze sono segnaposto. Ne risulta una forte resa estetica ma poca **evidenza nuova per ogni scorrimento**.

**Proposta:** sequenza più breve: 1) per chi è Proemios e risultato concreto; 2) scelta fra quattro punti di partenza; 3) cosa si riceve e chi decide; 4) un esempio editoriale verificabile; 5) fascia/preventivo e contatto. Mostrare una volta la dashboard come *anteprima*, non quattro. Finché i profili non sono verificati, mantenere ruoli ma attenuare la promessa di relazione personale oppure pubblicare nomi, qualifiche e processi verificati con consenso. La [sezione mobile del team](/home/ubuntu/proemios-audit/focus/mobile-team-settled.png) documenta la situazione attuale.

### G2 — Diagramma del percorso poco leggibile su telefoni stretti — P2

Nella [sezione delle sei fasi a 320 px](/home/ubuntu/proemios-audit/focus/mobile-320-steps.png) i sei pulsanti intorno al libro **non si sovrappongono**, ma le etichette hanno `font-size: 10,24px` e altezza di **39 px**. L’interazione richiede di interpretare sei micro-label distribuite nello spazio, mentre il messaggio principale (“cosa succede dopo?”) sarebbe più rapido da leggere in sequenza.

**Proposta:** mantenere il diagramma orbitale su desktop come elemento di marca; su mobile usare sei step verticali con nome, esito/consegna e stato attivo, testo almeno leggibile senza ingrandimento e tap target comodi. Il libro può restare immagine di supporto, non l’unico schema di navigazione.

### G3 — Due linguaggi di pagina servizio e un errore di microtipografia — P2

[Editing](/home/ubuntu/proemios-audit/focus/desktop-editing-viewport.png) usa un hero contemporaneo con titolo corallo e scheda; [Valutazione editoriale](/home/ubuntu/proemios-audit/focus/desktop-valutazione-viewport.png) usa una gabbia editoriale con colonna laterale, un diverso stile di CTA e la stringa visibile **“§ § · Servizio”** ([mobile](/home/ubuntu/proemios-audit/focus/mobile-valutazione-viewport.png)). Le due composizioni possono convivere come variazioni, ma oggi sembrano due generazioni di template.

**Proposta:** unificare gli elementi invarianti — breadcrumb, titolo, promessa, “cosa comprende”, consegna, fascia di prezzo se pubblica, CTA e FAQ — lasciando alla composizione editoriale un ruolo distintivo. Correggere `§ §` e controllare automaticamente microcopy/template su tutte le 40 URL.

### G4 — Contrasto e fiducia nelle interfacce — P1/P2

Nel [form di analisi manoscritto](/home/ubuntu/proemios-audit/mobile-form-contrast.png) le label “Nome” ed “Email” sul fondo scuro misurano **1,12:1**, come documentato nel primo audit. Il badge “Demo” e altri testi minuti restano sotto **4,5:1**. Correggere i token cromatici per i fondi scuri e verificare nuovamente con axe e test manuale. Nella demo, accostare alle CTA sensibili una nota contestuale su report/email simulati: il banner generale non basta a chiarire ogni promessa locale.

### U1 — Perdita dell’intento fra pagina servizio e preventivo — P1

La [Valutazione editoriale](https://proemios.vercel.app/servizi/valutazione-editoriale) pubblica la fascia **149–349 €** e invia a `/preventivo?tipo=romanzo&servizio=valutazione-editoriale`. Il parametro `tipo=romanzo` **funziona**: Romanzo risulta preselezionato. Ho proseguito fino al passo **4/6**: le opzioni sono Editing, Correzione bozze, Impaginazione, EPUB, Copertina, KDP, ISBN e Scheda Amazon; **Valutazione editoriale non compare e nessun servizio è selezionato**. L’anteprima mostra invece tre pacchetti generici. Non ho inviato il modulo finale, quindi non affermo cosa succeda al backend.

**Correzione:** se si offre una valutazione acquistabile, aggiungerla come scelta autonoma e preservarla nel riepilogo, oppure usare una richiesta dedicata con fascia di prezzo e consegne. Non trasformare silenziosamente la richiesta di un singolo servizio in tre pacchetti differenti. In modo analogo, la CTA “Parla con un editor” invia a `?motivo=editor` ma il form non mostra né precompila quel motivo (primo audit).

### U2 — Navigazione, accesso e casi studio — P1/P2

La voce “Accedi” e il footer “Entra nel tuo spazio” suggeriscono un account autore, ma `/accedi` descrive un backoffice per il team; il link a `/admin` risponde 401 senza credenziali, comportamento atteso. Rinominare “Accesso team” e segnalare che la dashboard autore è un’anteprima, finché non esiste il percorso autore. La pagina [Casi studio](https://proemios.vercel.app/casi-studio) non collega i tre casi dettagliati elencati nella sitemap: l’utente non può esplorarli dalla pagina promessa. Se i casi non sono pronti, rimuoverli dalla sitemap pubblica; se sono pronti, mostrarli nell’indice con stato e verifiche chiari.

## 2. SEO tecnico e usabilità nei risultati

**Inventario verificato:** 40 URL nella sitemap, tutte `200`, con HTML iniziale contenente H1 e testo (non solo una shell JavaScript); due URL inesistenti testati restituiscono **404** corretti. Tutte hanno titolo, descrizione e JSON-LD `Organization`. Questi sono punti positivi. Il [CSV delle 40 URL](/home/ubuntu/proemios-audit/focus/inventario-seo-proemios.csv) permette di filtrare i problemi per pagina.

### S1 — Indicizzazione e dominio: blocco pre-lancio — P0 se pubblico

`robots.txt` contiene `Disallow: /` per `User-Agent: *`: con le regole attuali **Googlebot, Bingbot e OAI-SearchBot non possono scansionare** le pagine di contenuto. La home ha inoltre `noindex, nofollow`. Nella sitemap tutti i **40 `<loc>`** indicano `proemios-fgpplis70-valerio-gestri-s-projects.vercel.app`, un host che al test rimandava al login Vercel; **39/40 canonical** nell’inventario puntano a quell’host e la home a `proemios.it`, non risolvibile dall’ambiente al momento del test. Il JSON-LD `Organization.url` ripete l’host di anteprima su tutte le 40 pagine. I 40 `lastmod` hanno lo **stesso timestamp**: verificare se rappresenta davvero la modifica del contenuto e, in caso contrario, usare date effettive.

**Scelta consigliata:** definire la matrice *demo/noindex* e *produzione/indexable* per route; predisporre origin unico verificato per canonical, `og:url`, schema e sitemap; poi testare Googlebot e crawler di ricerca AI, URL Inspection e sitemap dal dominio finale. **Non** aprire la demo ai bot soltanto per migliorare un punteggio Lighthouse.

### S2 — Pagine senza link interni e duplicazioni di percorso — P1

Fra le 40 pagine della sitemap, **9 non ricevono alcun link `<a>` da un’altra delle 40 pagine nel loro HTML pubblico**: `/dal-diario-al-libro`, `/libro-per-professionisti`, `/strumenti-ai`, `/servizi/valutazione-editoriale`, `/servizi/copertina-e-impaginazione`, `/servizi/partner-white-label` e i **tre casi studio dettagliati**. La sitemap aiuta a scoprirle, ma non sostituisce una navigazione utile. Due pagine top-level (`/dal-diario-al-libro`, `/libro-per-professionisti`) dichiarano inoltre nel JSON-LD `Service.url` un’altra route (`/servizi/...`), aumentando l’ambiguità. Non ho fatto una valutazione completa di contenuto duplicato fra tutte queste coppie.

**Correzione:** decidere per ogni tema una pagina primaria e un percorso di accesso: card nella hub Servizi/Percorsi, link contestuali dalle guide, casi studio dall’indice; se due URL sono versioni dello stesso contenuto, consolidare con canonical/redirect coerenti. Se una pagina è sperimentale o non verificata, escluderla dalla sitemap pubblica anziché lasciarla orfana.

### S3 — Anteprime e snippet poco specifici — P2

- **39/40 pagine** non hanno `og:image`, anche se tutte dichiarano `twitter:card=summary_large_image`. L’unica immagine social, della home, punta al dominio `proemios.it` che non si risolveva nel test. Preparare immagini social realmente accessibili, almeno per home, servizi principali, guide e casi verificati.
- **7 pagine hub** condividono identica meta description (“Un unico percorso editoriale…”): `/servizi`, `/per-agenzie`, `/come-funziona`, `/casi-studio`, `/blog`, `/chi-siamo`, `/percorsi`. Descrivere invece l’intento unico di ciascuna. Esempio: per `/come-funziona`, “Dall’analisi del manoscritto alle approvazioni: scopri tappe, consegne e ruoli del percorso editoriale Proemios.” Usare solo promesse confermate dal servizio.
- Titoli molto brevi come “Editing · Proemios” sono validi ma poco informativi fuori contesto. Un titolo più utile potrebbe essere **“Editing di libri: cosa include e quando serve | Proemios”**; la SERP può comunque riscrivere titolo e snippet. Google ricava gli snippet soprattutto dal contenuto visibile e talvolta dalla meta description, quindi la qualità della pagina resta centrale.

## 3. AEO e GEO: prima accesso, poi risposte verificabili

**AEO** (*answer engine optimization*) e **GEO** (*generative engine optimization*) sono etichette operative, non un sistema di ranking separato e garantito. Nella [guida ufficiale Google sulle funzioni AI](https://developers.google.com/search/docs/appearance/ai-features), una pagina deve essere indicizzata e idonea a uno snippet per poter comparire come link di supporto in AI Overviews/AI Mode; Google afferma che non occorrono schema speciali o file `llms.txt`. La [guida Google 2026](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) privilegia SEO di base, contenuti originali non commodity e struttura chiara. Per ChatGPT Search, [OpenAI distingue OAI-SearchBot da GPTBot](https://developers.openai.com/api/docs/bots): si può decidere separatamente accesso alla ricerca e uso per training. L’attuale `Disallow: /` blocca entrambi; questa può essere la scelta giusta per la demo, non per un eventuale lancio che desideri discoverability.

### A1 — Le guide rispondono, ma non dimostrano abbastanza — P2

Le tre guide `/blog/...` hanno **94, 107 e 95 parole nel corpo dell’articolo**, tre paragrafi ciascuna, nessun sottotitolo H2 nell’articolo, nessun autore/data visibile e nessun link contestuale a servizi o approfondimenti (solo “Torna alle guide”). Non c’è `Article`/`BlogPosting` JSON-LD; è presente il solo `Organization`. Il **numero di parole non è un fattore di ranking da ottimizzare meccanicamente**: il punto è che domande articolate, per esempio “Editing o correzione bozze?”, ricevono una distinzione corretta ma senza tabella decisionale, esempio commentato, condizioni, tempi o costo indicativo di ciascun intervento.

**Modello di risposta migliore, basato su quanto già pubblicato:**

> **Editing e correzione bozze: che differenza c’è?** L’editing interviene su struttura, ritmo, stile e coerenza mentre il testo è ancora modificabile. La correzione bozze cerca refusi, errori grammaticali e uniformità su un testo già stabilizzato. Se non sai da dove partire, una valutazione editoriale definisce il livello di intervento prima del preventivo.

A seguire: tabella “quando serve / cosa ricevi / cosa non include”, un mini prima-dopo **realmente prodotto o dichiarato dimostrativo**, criteri di scelta e link naturali a [Editing](https://proemios.vercel.app/servizi/editing), [Correzione bozze](https://proemios.vercel.app/servizi/correzione-bozze) e [Valutazione editoriale](https://proemios.vercel.app/servizi/valutazione-editoriale). Aggiungere autore reale o team editoriale responsabile e date **solo se verificabili**. `Article`/`BlogPosting` può descrivere autore, headline e date accurate, ma non garantisce visibilità: [linee guida Google per Article](https://developers.google.com/search/docs/appearance/structured-data/article).

### A2 — Credibilità dei casi: messaggi pubblici incompatibili — P1

L’[indice Casi studio](https://proemios.vercel.app/casi-studio) dichiara che i casi sono “in preparazione” e che si pubblicheranno solo progetti verificati. Nella sitemap ci sono però tre URL diretti: [diario → romanzo](https://proemios.vercel.app/casi-studio/dal-diario-di-una-vita-a-un-romanzo) descrive un romanzo pubblicato e contiene una citazione attribuita al “committente”; [revisione con ISBN proprio](https://proemios.vercel.app/casi-studio/revisione-e-pubblicazione-con-isbn-proprio) rivendica due formati pubblicati e zero file rifiutati; [manuale professionale](https://proemios.vercel.app/casi-studio/manuale-di-un-professionista) è invece marcato “esempio dimostrativo”. Non posso stabilire se i primi due siano reali o autorizzati: **questa è una discrepanza verificata fra presentazioni**, non un’accusa di falsità.

**Correzione:** verificare stato, autorizzazione, fatti, numeri e testimonial. Pubblicare i casi reali dall’indice con contesto (problema, materiale iniziale, intervento, consegne, risultato verificabile) e attribuzione consentita; contrassegnare ogni esempio illustrativo in cima alla pagina e nel title/snippet, senza farlo passare per risultato cliente. Per GEO, la citabilità deriva da fatti unici e verificabili, non da schema o citazioni inventate.

### A3 — Dati strutturati: correggere, non moltiplicare — P2

Nel campione di 40 pagine: `Organization` su 40, `BreadcrumbList` su 12, `Service` su 8 e `FAQPage` su 9. I tipi sono utili solo se rappresentano ciò che l’utente vede e gli URL sono validi: [Google non garantisce rich result](https://developers.google.com/search/docs/appearance/structured-data/sd-policies). Due `Service.url` su pagine top-level indicano la corrispondente route `/servizi/...`; `Organization.url` e i provider indicano il preview host protetto. Correggere prima questi identificatori, poi validare la pagina finale con Rich Results Test e URL Inspection.

I blocchi domanda-risposta visibili sulle pagine servizio sono utili alle persone: conservarli e renderli specifici. **Non** aggiungere decine di FAQ solo per il markup: Google [ha ritirato i FAQ rich result nel 2026](https://developers.google.com/search/updates). `FAQPage` non è una scorciatoia per comparire nelle risposte AI.

### A4 — Misurare senza promettere ranking — P2

Dopo il lancio su dominio deciso: 1) usare Search Console per verificare indicizzazione, canonical scelto, sitemap e query; 2) controllare nel report Performance e nelle funzioni AI disponibili le pagine che ricevono visibilità, senza confondere impression con citazioni; 3) monitorare log dei crawler autorizzati e referral da servizi di ricerca AI; 4) provare nel tempo un piccolo set fisso di domande pertinenti (“quanto costa una valutazione editoriale?”, “editing o correzione bozze?”, “come pubblicare con ISBN proprio?”), annotando data, motore, paese e URL citato. I risultati variano e nessuna ottimizzazione assicura menzioni.

## Piano di esecuzione proposto

**Fase 0 — decisione di pubblicazione (prima di toccare robots):** scegliere host canonico, pagine realmente pronte, policy per bot di ricerca/training, stato dei casi e veridicità delle promesse nei form. Consegnabile: matrice URL → *pubblica / noindex / ritira / consolida*.

**Fase 1 — correzioni strutturali:** allineare robots/sitemap/canonical/OG/Organization; rendere raggiungibili le landing valide e i casi verificati; correggere CTA Valutazione editoriale; sistemare contrasto del modulo e `§ §`. Verifica: request HTML senza JS, 404 sconosciute, link in ingresso, rich result test.

**Fase 2 — esperienza e contenuti:** ridurre home e mockup duplicati, trasformare orbit mobile in stepper, preparare social preview; riscrivere tre guide con risposte complete, esempi attribuiti e link ai servizi; creare schede autore/team verificate e dati `Article` corrispondenti al visibile.

**Fase 3 — misurazione:** Search Console e URL Inspection sul dominio finale, misure Core Web Vitals reali, test con 5–8 persone dei due percorsi “ho già scritto” e “ho un’idea”, e tracciamento periodico delle domande AEO/GEO senza promesse di ranking.

## Limiti e fonti

L’inventario misura **HTML pubblico, schema e collegamenti** del 6 ottobre 2026; non misura traffico organico, backlink, query reali, autorizzazioni dei casi o reale invio dei moduli. I controlli visuali sono campionati su desktop e mobile; lo spazio temporaneamente vuoto di un’immagine lazy-loaded è stato ricontrollato dopo il caricamento e **non** classificato come bug. Le stime di tempo/costo citate sono testo pubblicato nel sito, non tariffe da me validate. Non sono state effettuate modifiche al sito.

**Fonti metodologiche:** [Google — AI features](https://developers.google.com/search/docs/appearance/ai-features), [Google — guida AI Search 2026](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [Google — snippet e meta description](https://developers.google.com/search/docs/appearance/snippet), [Google — structured data](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [OpenAI — crawler](https://developers.openai.com/api/docs/bots).
