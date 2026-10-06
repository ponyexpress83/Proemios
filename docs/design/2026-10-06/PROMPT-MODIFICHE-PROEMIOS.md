# Prompt operativo — Restyling e funzionalità di Proemios

**Riferimento:** https://proemios.vercel.app/

**Repository:** https://github.com/ponyexpress83/Proemios

**Controllo effettuato:** 6 ottobre 2026.

**Base di codice esaminata:** branch `claude/kalamos-studio-phase-1-6z6xyw`, commit `338d368`.

La homepage osservata nel browser è coerente con i componenti di questa base: libro 3D, percorso animato verticale, assistente preventivo, quattro percorsi e anteprima italiana dell’area autore. Questa corrispondenza visiva non certifica quale commit sia stato distribuito su Vercel. Prima di intervenire, controlla eventuali aggiornamenti del branch e il deploy corrente. L’HTML estratto senza browser può mostrare contenuti diversi: usa anche la pagina renderizzata.

**Ambito di questa consegna:** il testo seguente è un prompt per un intervento successivo. Le cinque proposte di logo sono materiali separati; nessun logo è stato scelto o inserito nel sito con questa consegna.

---

## Prompt da copiare

Agisci come senior product designer e sviluppatore frontend/full-stack. Lavora nel repository `ponyexpress83/Proemios` sulla versione corrispondente a https://proemios.vercel.app/. Implementa le modifiche sotto indicate, non limitarti a proporre un piano. Conserva il carattere editoriale del sito, il libro 3D e le funzioni già presenti. L’obiettivo è un’esperienza più originale, coinvolgente e chiara, che trasformi l’interesse per il libro in un preventivo senza confusione.

### 1. Prima di modificare

- Controlla branch, stato Git e modifiche già presenti. Non lavorare su una versione vecchia della homepage e non sovrascrivere interventi altrui.
- Crea un branch dedicato. Non fare merge o deploy pubblico automatico.
- Esamina il sito renderizzato su desktop e mobile, non solo il suo HTML iniziale.
- Riutilizza Next.js, React, TypeScript e i componenti esistenti. Non ricostruire il sito in un altro framework.
- Mantieni prezzi e calcoli in `lib/pricing.ts` e `config/pricing.ts`: non inventare tariffe e non duplicare il motore di preventivazione.
- Mantieni il logo attuale. Le cinque varianti esterne sono solo concept in attesa di una scelta: non integrarne una autonomamente e non sostituire marchio, favicon o immagini social.

### 2. Hero: un libro più grande e un’azione evidente

La scena attuale è interessante, ma non comunica abbastanza che il libro è cliccabile.

- Mantieni e valorizza il libro 3D, con una superficie visiva più ampia e una copertina ben leggibile. Recupera spazio togliendo il blocco duplicato sotto la scena, senza aumentare inutilmente l’altezza della prima schermata.
- Elimina solo il blocco `.hero-quote-invite` con «Quanto costa il tuo libro?», «Scopri una prima stima…» e il relativo bottone. Non eliminare la CTA finale in fondo alla homepage, che ha una funzione diversa.
- Rendi inequivocabile l’interazione sul libro con una piccola etichetta ancorata alla copertina: **«Clicca sul libro per il preventivo»** su desktop e **«Tocca il libro per il preventivo»** sui dispositivi touch. L’etichetta deve essere visibile anche senza hover, non solo in un tooltip.
- Aggiungi un leggero segnale visivo: freccia verso la copertina, lieve sollevamento o luce di bordo. Evita dita giganti, pulsazioni continue e grafica da pubblicità.
- Conserva un vero bottone accessibile per il libro, con nome comprensibile, focus visibile e attivazione da tastiera. Le superfici decorative non devono intercettare il click.
- Aumenta i bottoni a sinistra: altezza indicativa 54–60 px su desktop, testo leggibile e ampio padding. Su mobile rendili facilmente raggiungibili e, quando serve, a tutta larghezza.
- CTA primaria: **«Calcola il preventivo»**. CTA secondaria: **«Parla con un editor»**, collegata a `/contatti?motivo=editor`.
- Il libro e la CTA primaria devono aprire lo stesso assistente di preventivo, con una sola logica condivisa. Mantieni `/preventivo` come percorso completo e come alternativa funzionante alla modalità in finestra. Non creare due preventivatori che perdono o interpretano diversamente le risposte.
- Nell’assistente preserva domande, risposte, modifica delle scelte, dettatura con attivazione esplicita, riepilogo e passaggio al configuratore completo. In caso di browser non compatibile, la tastiera deve bastare per completare il flusso.

### 3. Animazione originale: scomposizione e ricomposizione

Non voglio soltanto una lista verticale che scorre «Editing», «Revisione», «Copertina» e così via. Voglio una piccola narrazione visiva della trasformazione del progetto.

- Mantieni le sei fasi: **Manoscritto → Editing → Revisione → Copertina → Impaginazione → Pubblicazione**.
- Crea una sequenza in cui un pannello visivo si scompone in piccoli tasselli quadrati, i tasselli si riallineano e ricompongono la schermata o la slide della fase successiva.
- Usa una griglia contenuta, per esempio 4×4 o 5×5, con trasformazioni `translate`, `rotate` e `opacity` sfalsate. L’effetto deve sembrare carta, gabbia editoriale e composizione tipografica, non un’esplosione casuale.
- Ogni fase deve avere una scena riconoscibile: pagine del manoscritto, annotazioni editoriali, revisione approvata, proposta di copertina, gabbia di impaginazione, volume finale. Non cambiare soltanto il titolo mantenendo tutto il resto identico.
- Anima i tasselli su un livello puramente decorativo. Testi, bottoni e contenuti accessibili devono restare DOM leggibile: non trasformare tutta l’interfaccia in una fotografia non accessibile.
- Mantieni il libro come punto focale e target di click stabile. Non farlo scomparire o renderlo inutilizzabile durante le transizioni.
- Timing di partenza: transizione di circa 600–900 ms, poi una permanenza di almeno 4–5 secondi per leggere. Massimo un ciclo automatico; al termine mostra «Rivedi il percorso».
- Prevedi selezione manuale delle fasi e controlli pausa/ripresa, con indicatore della fase attiva. Se l’utente sceglie una fase, non portarlo via automaticamente.
- Sospendi l’avanzamento durante l’interazione e quando la scena è fuori viewport o la scheda non è visibile.
- Con `prefers-reduced-motion`, disattiva scomposizione, tilt e autoplay: mostra scene statiche selezionabili. Su mobile riduci il numero di tasselli e usa una transizione più semplice se necessario.
- Non applicare lo stesso effetto a tutte le sezioni: la hero è il momento spettacolare, il resto del sito deve respirare.

### 4. Analisi del manoscritto: nel preventivo, opzionale e spiegata

Togli «Analisi gratuita del testo» dalle azioni principali della hero. È una promessa poco chiara e distrae dal percorso principale.

- Inserisci nel configuratore un passaggio facoltativo dopo le informazioni sul testo, intitolato **«Vuoi una prima valutazione del manoscritto?»**.
- Descrivi concretamente cosa fa: conteggio e metriche del testo, prima indicazione degli interventi editoriali, eventuale report preliminare. Specifica se il giudizio è automatizzato, assistito o verificato da un professionista in quel flusso. Non promettere una lettura integrale da parte di un editor se non è prevista.
- L’utente deve poter scegliere **«Continua senza caricare un testo»** e ottenere comunque la stima. Se parte soltanto da un’idea, non chiedere un manoscritto inesistente.
- Riutilizza i componenti e l’API di analisi esistenti, senza replicare upload o motore di analisi. Un’integrazione tramite sottopercorso è accettabile se conserva il brief e riporta al preventivo senza perdere le risposte.
- Non chiamarla «gratuita» senza verificare le condizioni effettive. Se mantenuta, chiarisci cosa è incluso, eventuali limiti e la differenza da una valutazione editoriale completa.
- Lascia raggiungibile `/analisi-manoscritto` da una posizione secondaria e mantieni coerenti i link esistenti.
- Non sostenere che la prima stima anonima richieda nome/email: distinguila dall’eventuale analisi, il cui endpoint attuale richiede dati di contatto e presa visione della privacy.

#### Diritti, riservatezza e utilizzo dei file

Prima del caricamento mostra una spiegazione sintetica e un link ai dettagli. Verifica e documenta:

1. A quale finalità serve il file e se viene elaborato soltanto un estratto da un fornitore esterno.
2. Chi può accedere a file, metadati e report; quali elementi vengono realmente conservati.
3. Tempi di conservazione e procedura di cancellazione effettivamente disponibile.
4. Condizioni contrattuali relative a diritti dell’autore, eventuali licenze e riservatezza.
5. Quali fornitori trattano il testo e dove trovare l’informativa pertinente.

L’API attuale non archivia il testo integrale nel database, ma memorizza metadati e report in produzione; il codice imposta una scadenza. **Non equiparare una data di scadenza a una cancellazione automatica verificata.** In demo il report è simulato sulle metriche del file e alcuni dati restano temporaneamente in memoria: non dichiarare «nessun dato viene mai trattato».

Non usare «copyright garantito», «sicurezza assoluta», «nessuno accede al testo» o «non usato per addestrare modelli» senza verifica documentale e tecnica. Riservatezza, diritto d’autore e registrazione/deposito dell’opera non sono la stessa cosa. Mantieni le informazioni coerenti con privacy, termini e contratti; segnala separatamente eventuali testi da sottoporre a validazione legale. La presa visione della privacy e l’eventuale consenso marketing devono essere distinti; marketing non preselezionato e non necessario per ottenere il servizio.

### 5. «Ogni libro parte da un punto diverso»: cinque percorsi chiari

Rendi le card più attraenti e meno simili a quattro quadrati generici. Mantieni poche scelte: **cinque in totale**, senza trasformare la sezione in un catalogo.

Usa questi testi di partenza, affinabili soltanto per scorrevolezza:

| Percorso | Titolo | Descrizione breve |
| --- | --- | --- |
| Manoscritto | Ho già scritto il libro | Hai un manoscritto: lavoriamo su revisione, copertina e pubblicazione. |
| Idea | Ho un’idea da sviluppare | Mettiamo a fuoco l’idea e la trasformiamo in un progetto di libro. |
| Storia personale | Voglio raccontare una storia vera | Ricordi, esperienze e testimonianze diventano un racconto. |
| Competenza | Sono un professionista o un formatore | Trasformiamo il tuo metodo, le tue competenze e i materiali dei tuoi corsi in un libro. |
| Impresa e lavoro | Voglio raccontare la mia impresa | La storia della tua azienda o del tuo percorso di lavoro, raccontata con cura. |

- Parla di **corsi**, non di videocorsi. Il quarto percorso deve rendere concreti gli usi: manuale, libro di metodo, contenuti formativi o libro specialistico.
- Il quinto percorso copre imprenditori, storia aziendale e storia professionale. Non aggiungere altre categorie separate per questi casi.
- Usa oggetti editoriali distinti, piccoli segni tipografici, texture leggere o illustrazioni sobrie. Devono aiutare a distinguere i percorsi, non essere soltanto icone decorative.
- Prevedi leggero tilt o sollevamento, bordo e freccia animata su hover/focus. Tutta la card deve essere cliccabile e mostrare una gerarchia chiara tra numero, titolo, descrizione e azione.
- Bilancia la griglia a cinque elementi, senza lasciare un’unica card orfana e stretta. È possibile una composizione 3+2 con le ultime due più ampie; su mobile usa una colonna, non un carosello obbligatorio.
- Mantieni gli slug dei quattro percorsi esistenti. Aggiungi una pagina reale per il quinto, per esempio `/percorsi/storia-d-impresa`, con spiegazione, materiali di partenza, fasi e CTA al preventivo.
- Aggiorna contenuti, elenco percorsi, pagina dinamica, metadati, sitemap quando pertinente e collegamenti al configuratore. Se la tipologia «impresa» non è prevista dal motore prezzi, mappala a una categoria supportata mantenendo il contesto nel brief: non introdurre un valore non riconosciuto o tariffe inventate.

### 6. Ordine delle sezioni: dashboard prima del processo

La schermata dell’area autore deve apparire prima, essere più visibile e fare da stacco cromatico. Adotta questo ordine come base:

1. Header e hero, prevalentemente avorio e corallo.
2. «Ogni libro parte da un punto diverso».
3. **Fascia blu «Il tuo libro. Tutto sotto controllo.»**, con anteprima aggiornata della dashboard.
4. «Dall’idea al libro. Un percorso chiaro.» e fasi del lavoro.
5. Breve blocco su chiarezza, diritti e pagamenti, senza affermazioni non verificate.
6. Servizi editoriali e confronto prima/dopo.
7. Collaborazione con agenzie, CTA finale e footer.

- Sposta `Platform` sopra la sezione del processo, non duplicarlo.
- Mantieni in hero soltanto un richiamo discreto alla piattaforma, se serve: il primo piano resta il libro. La dashboard completa è nella fascia blu, più in alto rispetto alla versione corrente.
- Evita una successione di grandi blocchi blu senza intervalli chiari. Il blu deve dare ritmo, non dominare ogni sezione.
- Non reinserire testimonianze, foto del team o casi studio inventati per riempire lo spazio.

### 7. Dashboard: anteprima fedele e demo navigabile

Aggiorna l’anteprima in homepage prendendo come riferimento l’area autore esistente, non uno screenshot obsoleto o un mockup di funzioni future.

La demo corrente contiene sette sezioni:

**Panoramica · Il mio libro · Messaggi · File e revisioni · Approvazioni · Pagamenti · Consegne.**

- Nell’anteprima oggi mancano le voci Approvazioni e Pagamenti: allinea le sette sezioni e condividi le definizioni di navigazione quando utile, evitando copie che divergono nel tempo.
- Mostra fase e avanzamento del libro, prossimo passo, revisione da approvare e una breve attività recente. Evita grafici finanziari o numeri privi di significato editoriale.
- Usa dati dimostrativi chiaramente riconoscibili e un badge **DEMO**. Non inserire dati personali reali.
- Rendi l’anteprima più grande e leggibile, con prospettiva lieve, senza inclinarla tanto da perdere i testi.
- Se la preview non è interattiva, non aggiungere pulsanti finti: usa una chiara CTA **«Prova l’area autore»** verso `/accedi`. Se introduci tab dimostrativi, devono cambiare davvero il pannello e non far credere di operare sul progetto reale.
- Nell’area autore verifica ingresso, uscita, menu mobile, messaggi di esempio, anteprima e download file, approvazione, avanzamento alla fase successiva, riepilogo pagamenti, consegne e ripristino demo.
- Ogni azione deve produrre un risultato o uno stato esplicito. Le consegne non ancora disponibili devono dirlo; nessun falso download e nessuna conferma di pagamento mai effettuato.
- Conserva la distinzione tra area autore e `/admin`.

### 8. Fiducia: chiarezza concreta, non slogan

Rafforza il messaggio che il percorso è chiaro e sotto controllo dell’autore.

- Presenta tre messaggi brevi: **«Costi chiari prima di iniziare»**, **«Ogni fase passa dalla tua approvazione»**, **«Diritti e riservatezza spiegati»**.
- Linka ai dettagli: cosa comprende il preventivo, cosa può generare costi aggiuntivi, revisioni incluse, condizioni contrattuali e privacy.
- Esplicita che la prima stima è indicativa e che il perimetro definitivo va concordato. Non nascondere costi esterni o maggiorazioni già previsti.
- Per i pagamenti usa **«Pagamenti gestiti tramite Stripe»** soltanto dove l’integrazione è realmente configurata e verificata. Nella demo scrivi **«Pagamento simulato: nessun addebito»**.
- Non aggiungere loghi di certificazioni, badge di garanzia, stelle o recensioni non documentate.
- Preserva la comunicazione corretta sul processo assistito dalla tecnologia e sul controllo professionale; non convertirla in «100% umano».

### 9. Header e footer: distinti, dinamici, leggibili

Per «upper sidebar» intendo la navigazione orizzontale superiore del sito pubblico, non la sidebar interna dell’area autore.

- Dai all’header un fondo leggermente diverso dal corpo: un avorio più freddo o un lavanda molto chiaro, coerente con la palette. Mantieni il corallo per la CTA.
- Dai al footer un fondo blu notte che riprenda la fascia della piattaforma, testo chiaro e accenti corallo. Non usare un secondo grande blocco chiaro indistinguibile dal corpo.
- Sui link principali della navigazione aggiungi un piccolo incremento di scala, lieve profondità/sollevamento e sottolineatura editoriale su hover e focus. Usa trasformazioni senza cambiare larghezze o spostare gli elementi vicini.
- Se l’header è sticky, assicurati che non copra titoli, ancore o focus e non occupi troppo schermo. Sul menu mobile gli stessi link devono funzionare senza hover.
- Usa microinterazioni 3D discrete per libro, card e preview, non per ogni parola e bottone. Nessuno scroll hijacking, cursore personalizzato obbligatorio o effetto che rallenta la navigazione.
- Controlla nel footer collegamenti, contatti e dati societari provenienti dalla configurazione; non inventare recapiti.

### 10. Funzionalità completa: cosa significa in questa versione

Voglio che tutte le parti visibili siano utilizzabili, ma non voglio una demo presentata come prodotto già operativo.

- Controlla tutte le destinazioni della navigazione, dei servizi, delle cinque card, delle CTA e dei link legali.
- Verifica assistente, configuratore, prezzi, conservazione del brief tra i passaggi, analisi facoltativa, form di contatto, form agenzie e stati loading/success/error.
- Gestisci file non supportati, file troppo grandi, testo troppo breve, errori del servizio e possibilità di proseguire senza upload.
- La demo autore usa `sessionStorage` e azioni simulate; non è autenticazione cliente o archivio operativo. Conservala e dichiaralo, senza convertirla superficialmente in un’area clienti «sicura» con il solo frontend.
- Le API operative richiedono le integrazioni previste dal repository. Riutilizza configurazioni già autorizzate se disponibili, senza esporre segreti. Dove manca un prerequisito, mostra uno stato onesto e registra il requisito nel rapporto finale.
- Non mascherare un invio fallito come successo e non rimuovere gli avvisi demo per rendere la pagina più bella.
- Non introdurre migrazioni distruttive, nuovi addebiti, invii di manoscritti reali o transazioni reali durante i test. Usa esclusivamente dati sintetici e, se disponibili, ambienti di test.
- La messa in produzione di account reali, archivio documenti e permessi è un’attività distinta se non già disponibile: elenca i blocchi, non inventare che basti un restyling.

### 11. Accessibilità, responsive e prestazioni

- Nessun overflow orizzontale a 360, 390, 768, 1280 e 1440 px. Controlla anche zoom al 200%.
- Target touch di almeno 44×44 px; focus visibile; uso completo da tastiera.
- I dialog devono gestire focus iniziale, contenimento del focus, chiusura con Escape e ritorno del focus al controllo che li ha aperti.
- Contrasto leggibile per header, fascia blu, footer e CTA. I dettagli corallo su avorio non devono diventare testo poco leggibile.
- Nessun contenuto fondamentale disponibile soltanto all’hover o soltanto grazie a un’animazione.
- Preferisci `transform` e `opacity`; limita ombre e blur pesanti; sospendi animazioni non visibili; evita librerie 3D aggiuntive se CSS basta.
- Non duplicare la dashboard completa in decine di tasselli DOM. Mantieni leggero il livello decorativo.
- Mantieni testo e struttura utili già renderizzati; le animazioni sono un miglioramento progressivo, non un prerequisito per capire il servizio.

### 12. File e punti di intervento da verificare

Questi sono riferimenti, non un elenco da modificare indiscriminatamente:

- `components/editorial/proemios.tsx`: hero, azioni, percorsi, ordine delle sezioni e fascia piattaforma.
- `components/editorial/book-path.tsx`: fasi e controllo dell’animazione.
- `components/editorial/book.tsx`: libro 3D e relative superfici.
- `components/editorial/quote-assistant.tsx`: assistente, accessibilità e riuso del flusso.
- `components/editorial/dashboard-preview.tsx` e `elements.tsx`: anteprima dashboard.
- `components/author/workspace.tsx` e `lib/author-demo.ts`: area autore dimostrativa.
- `lib/editorial-content.ts`, `components/editorial/internal-pages.tsx`, `app/percorsi/[slug]/page.tsx`: contenuti e nuovo percorso.
- `components/editorial/site-chrome.tsx` e `chrome.tsx`: header/footer pubblici, verificando quali sono effettivamente montati.
- `components/preventivo/*`, `components/analisi/*` e `app/api/analisi/route.ts`: integrazione dell’analisi facoltativa.
- `app/editorial.css` e `app/experience.css`: responsive, colori, effetti e animazioni. Evita una nuova catena di override contraddittori.
- `config/legal.ts`, privacy e termini: coerenza delle informazioni, senza aggiungere garanzie non supportate.
- `tests/interactive-experience.test.ts`, `tests/demo.test.ts` e `tests/pricing.test.ts`: regressioni e casi nuovi.

### 13. Verifica e consegna

Esegui e riporta i risultati reali di:

```bash
npm ci
npm run typecheck
npm run test
npx eslint .
npm run build
```

Nel repository lo script `lint` richiama `next lint`: verifica la compatibilità con la versione installata e, per il controllo previsto qui, usa `npx eslint .`.

Aggiungi test mirati per:

- stesso ingresso al preventivo dal libro e dalla CTA;
- nessuna regressione di prezzi e passaggio delle risposte;
- selezione, pausa e fine delle sei fasi;
- percorso facoltativo senza manoscritto e ritorno dall’analisi senza perdita del brief;
- nuovo percorso impresa raggiungibile;
- coerenza delle sette voci della dashboard;
- uso tastiera e reduced motion, tramite test adeguati e verifica nel browser.

Esegui uno smoke test desktop e mobile con dati sintetici. Raccogli screenshot prima/dopo di hero, percorsi, fascia piattaforma, header/footer e dashboard. Non descrivere un test come passato se non è stato eseguito; documenta eventuali blocchi di ambiente separatamente dai difetti di codice.

Apri una PR con riepilogo, screenshot, test, limiti ancora presenti e integrazioni necessarie per la produzione. **Non effettuare merge o pubblicazione sul sito pubblico.**

#### Criteri di accettazione

- [ ] È subito evidente che il libro apre il preventivo, anche su mobile.
- [ ] Il blocco duplicato sotto il libro è rimosso; immagine e CTA sono più grandi.
- [ ] Le fasi cambiano davvero scena con scomposizione/ricomposizione controllata.
- [ ] Analisi e upload sono facoltativi, spiegati e accompagnati da informazioni verificabili.
- [ ] Ci sono cinque percorsi, incluso impresa/lavoro; professionisti e corsi sono spiegati meglio.
- [ ] La fascia blu della dashboard è prima del processo, con anteprima fedele alle sette sezioni.
- [ ] Header e footer sono distinti; gli effetti dinamici non compromettono lettura e accessibilità.
- [ ] Costi, approvazioni, diritti e pagamenti sono comunicati con precisione, senza promesse inventate.
- [ ] Ogni controllo visibile funziona o espone esplicitamente il proprio stato demo/non disponibile.
- [ ] Test e verifica responsive sono documentati; nessun logo esterno è stato inserito automaticamente.
