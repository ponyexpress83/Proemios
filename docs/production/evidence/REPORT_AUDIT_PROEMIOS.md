# Audit di design e funzionalità — Proemios

**Sito esaminato:** [proemios.vercel.app](https://proemios.vercel.app/)  
**Data:** 6 ottobre 2026  
**Ambito:** sito pubblico, senza accesso al codice sorgente o al backoffice; nessun modulo inviato, pagamento effettuato o file personale caricato.

## Sintesi

Il linguaggio visivo è riconoscibile: tipografia editoriale, palette coerente, percorsi orientati al tipo di autore e preventivo interattivo. La navigazione pubblica esaminata funziona: **26 route collegate dalla home rispondono 200**, nelle 34 aperture automatizzate non ho rilevato errori JavaScript o risorse HTTP 4xx; dei **44 URL interni** verificati, l’unica risposta diversa da 200 è **`/admin` (401)**, coerente con un’area riservata. Non è emerso overflow orizzontale nei campioni a 320, 390 e 768 px.

Le priorità prima di un lancio pubblico sono tuttavia chiare: **etichette quasi invisibili nel modulo di analisi**, **domini SEO incoerenti**, **promesse dei flussi in contrasto con lo stato di demo** e **aspettativa di uno spazio autore che porta invece al backoffice del team**. Non interpreto l’assenza di salvataggio o invio dati come bug: il banner del sito dichiara esplicitamente che è una demo.

| Priorità | Problema | Effetto principale |
| --- | --- | --- |
| **P1 — prima del lancio** | Etichette “Nome” ed “Email” quasi invisibili nell’analisi manoscritto | Compilazione difficile; contrasto misurato **1,12:1** |
| **P1 — decisione di ambiente** | Sitemap, canonical, robots e dominio non allineati | Indicizzazione/condivisione incoerenti se il sito deve essere pubblico |
| **P1** | Copy dei flussi promette email/report/trattamenti non eseguiti dalla demo | Aspettative e fiducia dell’utente |
| **P1** | “Entra nel tuo spazio” conduce a un accesso solo per il team | Aspettativa funzionale disattesa per l’autore |
| **P2** | Controlli tastiera e contrasti secondari | Accessibilità incompleta |
| **P2** | Home lunga e prove sociali ancora segnaposto | Scansione e credibilità commerciale |
| **P2** | Performance mobile inferiore al desktop | Prima visualizzazione lenta in test sintetico |
| **P2** | CTA “Parla con un editor” non contestualizza il form | Attrito nel contatto |

## Metodo e risultati trasversali

- Crawl automatizzato: 26 pagine desktop a **1365 × 900**; 8 pagine rappresentative a **390 × 844**; verifiche aggiuntive a **320 e 768 px** per home, preventivo, analisi e contatti.
- Verificati stati HTTP, console, errori di pagina, richieste fallite, immagini visibilmente rotte, larghezza del documento, titoli, H1, canonical, robot meta e campi dei form. Il controllo dei link ha seguito 44 URL interni unici da queste pagine.
- **axe-core** su 8 tipologie di pagina desktop e mobile (16 esecuzioni); il contrasto dei problemi principali è stato verificato nuovamente **dopo il completamento delle animazioni**, per escludere falsi positivi dovuti al fade-in.
- **Lighthouse, singola esecuzione di laboratorio sulla home:** desktop Performance **99**, Accessibility **93**, Best Practices **100**, SEO **69**, LCP **0,9 s**; mobile Performance **71**, Accessibility **93**, Best Practices **100**, SEO **69**, LCP **5,3 s**, FCP **2,4 s**, TBT **180 ms**, CLS **0**. I punteggi non sono dati real-user e possono variare fra esecuzioni. Il 69 SEO è in larga parte spiegato dal blocco volontario dell’indicizzazione della home.

## Problemi verificati e correzioni

### 1. Etichette del form manoscritto illeggibili — P1

**Dove:** [Analisi manoscritto](https://proemios.vercel.app/analisi-manoscritto).  
**Riproduzione:** aprire la pagina, scorrere alla sezione “Dove mandiamo il report”, osservare le etichette **Nome** ed **Email** sopra i campi bianchi. Su fondo viola scuro usano testo blu molto scuro (`rgb(19, 25, 54)`); axe misura **1,12:1** su entrambe, contro l’obiettivo usuale **4,5:1** per testo normale. Il testo di supporto per i formati accettati è a **3,52:1**. Evidenza visiva: [screenshot del form mobile](/home/ubuntu/proemios-audit/mobile-form-contrast.png).

**Impatto:** un visitatore può non capire quali campi compilare, soprattutto su mobile o con vista ridotta.  
**Correzione:** applicare un colore chiaro alle label nel pannello scuro, mantenendo un contrasto verificato ≥4,5:1; aumentare il contrasto del testo sui formati; ripetere axe e controllo manuale con zoom 200%.

### 2. Segnali SEO che puntano a tre host diversi — P1, dipendente dalla destinazione del sito

**Dove:** [home](https://proemios.vercel.app/), [sitemap.xml](https://proemios.vercel.app/sitemap.xml), [robots.txt](https://proemios.vercel.app/robots.txt), pagine interne quali [preventivo](https://proemios.vercel.app/preventivo).  
**Riproduzione:** leggere i metadati HTML e la sitemap.

- La home e `/accedi` espongono `noindex, nofollow`; `robots.txt` risponde `User-Agent: *` e `Disallow: /`.
- **Tutti i 40 `<loc>` della sitemap** puntano a `proemios-fgpplis70-valerio-gestri-s-projects.vercel.app`, non al dominio pubblico esaminato. Visitando quell’host durante il test si arrivava alla pagina di login Vercel.
- **24 delle 26 route desktop** hanno canonical verso quello stesso URL di anteprima protetto e nessun meta robots; home e `/accedi` hanno invece canonical verso `https://proemios.it/`. Al momento del test `proemios.it` non si risolveva via DNS dall’ambiente di audit; anche l’`og:image` della home punta a quel dominio.

**Interpretazione corretta:** se questa è **solo una demo/staging**, `noindex` e il blocco in robots possono essere intenzionali. Il problema è l’incoerenza fra pagine e una sitemap pubblica che elenca URL protetti. Se invece `proemios.vercel.app` deve essere la vetrina indicizzabile, il blocco impedisce l’indicizzazione e i canonical indicano destinazioni non utilizzabili.  
**Correzione:** decidere il dominio di produzione; generare `metadataBase`, canonical, Open Graph, robots e sitemap dallo **stesso host canonico verificato**. In staging, applicare una policy `noindex` coerente su tutte le route e non pubblicare una sitemap che promuove URL privati; in produzione, sbloccare solo le route desiderate dopo il collegamento del dominio. Verificare la risoluzione e l’immagine social dal dominio finale.

### 3. Promesse dei form in conflitto con il banner demo — P1

**Dove:** [analisi manoscritto](https://proemios.vercel.app/analisi-manoscritto), [preventivo](https://proemios.vercel.app/preventivo), [privacy](https://proemios.vercel.app/privacy).  
**Riproduzione:** confrontare il banner (“i dati che inserisci non vengono salvati né inviati… l’analisi del manoscritto è simulata”) con i testi interni. La pagina analisi afferma che il report “ti arriva anche via email” e che l’estratto è cancellato “entro 30 giorni”; l’anteprima del preventivo dice che il preventivo definitivo arriva via email. La privacy descrive trattamenti operativi del sito `proemios.it`.

**Impatto:** anche con il banner, il visitatore potrebbe aspettarsi una consegna o interpretare erroneamente cosa avviene ai propri dati. Non ho inviato form o verificato il backend: questa è una **incoerenza di comunicazione verificata**, non una conclusione sul trattamento effettivo dei dati.  
**Correzione:** in demo, mostrare vicino a ogni form una nota contestuale “anteprima simulata, nessuna email sarà inviata, non caricare manoscritti reali”; sostituire frasi future/operative con il condizionale o dati di esempio e separare chiaramente la documentazione della futura produzione. Prima del go-live, confrontare ogni promessa con comportamento reale e informativa approvata.

### 4. Spazio autore presentato, ma accesso riservato al team — P1

**Dove:** link [“Entra nel tuo spazio”](https://proemios.vercel.app/accedi) nel footer e descrizione della dashboard in home; pagina [Accedi](https://proemios.vercel.app/accedi).  
**Riproduzione:** seguire “Entra nel tuo spazio”: la pagina specifica “Il backoffice esistente raccoglie preventivi…” e “Accesso riservato al team”; il pulsante va a `/admin`, che nel test risponde **401** senza credenziali. La stessa pagina dice all’autore “Parla con noi”.

**Impatto:** la home promette che l’autore possa seguire stati, messaggi, file e approvazioni in un unico spazio, ma il percorso attuale non offre un accesso autore. Il 401 non è un bug di sicurezza: è il comportamento atteso di un backoffice protetto.  
**Correzione:** finché l’area autore non esiste, chiamare il link “Accesso team” e marcare la dashboard come **anteprima** anche vicino alle CTA; non suggerire accesso self-service agli autori. Quando il prodotto sarà pronto, creare un ingresso separato per autori con onboarding e ruoli appropriati.

### 5. Accessibilità dei controlli e dei testi secondari — P2

- **Slider prima/dopo** della [home](https://proemios.vercel.app/) e di [Editing](https://proemios.vercel.app/servizi/editing): elemento `role="slider"` con valore ma **senza nome accessibile** (`aria-input-field-name`, severità serious in axe). Riproduzione: raggiungerlo con Tab o analizzare l’albero accessibile; assegnare un’etichetta descrittiva, per esempio “Confronto testo originale e revisionato”, e istruzioni tastiera/valore leggibili.
- **Area testimonianze mobile** della home: `.testimonial-grid` è scorrevole ma axe la segnala non raggiungibile via tastiera (`scrollable-region-focusable`). Renderla focusable con nome, pulsanti precedente/successivo oppure usare un layout non dipendente dallo scroll orizzontale.
- **Menu mobile:** a 390 px il pulsante apre correttamente la navigazione (`aria-expanded: false → true`), ma premendo **Escape** il menu resta aperto (`true`). Aggiungere chiusura da Escape e gestione del focus; non ho verificato tutti gli scenari di screen reader.
- **Contrasti residui**, misurati dopo stabilizzazione: etichetta “Demo” **4,2:1**, testo “Tipo di progetto” nel preventivo **4,22:1**, suggerimenti nel confronto editoriale circa **4,27–4,43:1**. Aumentare il contrasto dei testi piccoli almeno a 4,5:1. Axe segnala inoltre salti nell’ordine dei titoli del footer e contenuto del banner fuori dai landmark in più route: rivedere gerarchia `h1`–`h2`–`h3` e `header`/`main`/`footer`.

### 6. Fiducia e gerarchia della home — P2

**Dove:** [home](https://proemios.vercel.app/), [Casi studio](https://proemios.vercel.app/casi-studio), [Chi siamo](https://proemios.vercel.app/chi-siamo).  
**Evidenza:** la home contiene **11 sezioni**, altezza misurata circa **11.538 px a 390 px** e **8.722 px a 1280 px**; lo stesso mockup dashboard compare **4 volte**. Le testimonianze riportano chiaramente “Testimonianza da inserire” e i profili team sono da verificare; la pagina Casi studio dice onestamente che i casi sono in preparazione.

**Valutazione di design:** la scelta di non inventare prove sociali è corretta, ma una sequenza lunga di mockup e blocchi segnaposto sottrae spazio a prove concrete del metodo. Non è un guasto tecnico.  
**Miglioramento:** comprimere la home in una sequenza più nitida: promessa → scelta del percorso → come funziona → esempio editoriale verificabile → preventivo/contatto. Mostrare il mockup una volta, poi una dimostrazione interattiva o un diagramma di consegne reali. Nascondere i blocchi di testimonianze finché non sono disponibili casi autorizzati, oppure sostituirli con esempi anonimi **esplicitamente illustrativi**. Su mobile, il banner demo occupa circa 98 px prima dell’header: mantenerne il contenuto chiaro ma valutare una versione compatta dopo la prima visualizzazione.

### 7. Prima visualizzazione mobile da ottimizzare — P2

**Dove:** [home](https://proemios.vercel.app/).  
**Evidenza:** nel singolo test Lighthouse mobile LCP **5,3 s** e score Performance **71**, contro **0,9 s** e **99** desktop. Nel dettaglio del LCP mobile, circa **4,7 s / 89%** sono classificati come *render delay*; Lighthouse indica trasferimento totale di circa **905 KiB**, di cui **617.413 byte (~603 KiB) in 17 file font**. Segnala anche ~**36 KiB** potenzialmente risparmiabili con una dimensione immagine hero più appropriata. Lo screenshot dopo 400 ms mostrava ancora il fade-in del testo e dei pulsanti; dopo 2,5 s erano leggibili: non attribuisco il ritardo a una causa unica senza profiling del codice.

**Correzione:** fare subset e conversione dei font OTF a WOFF2, ridurre pesi/varianti effettivamente caricati, verificare `font-display` e preload critici; evitare che il contenuto above-the-fold rimanga inizialmente attenuato, rispettare `prefers-reduced-motion`, ridimensionare l’immagine hero secondo il viewport. Ripetere Lighthouse 3–5 volte e misurare Web Vitals reali quando disponibili.

### 8. Percorso “Parla con un editor” senza contesto — P2

**Dove:** CTA in [home](https://proemios.vercel.app/) → [contatti?motivo=editor](https://proemios.vercel.app/contatti?motivo=editor).  
**Riproduzione:** aprire la CTA e confrontare con `/contatti`: il modulo è lo stesso, i campi partono vuoti e il parametro `motivo=editor` non cambia copy o selezione.  
**Correzione:** preselezionare “Voglio parlare con un editor” o mostrare un’intestazione contestuale e trasmettere il motivo al team; in alternativa togliere il parametro se non serve. Il configuratore di preventivo funziona fino al **passo 6 di 6**, mostrando tre prezzi indicativi già dal passo 3: considerare un riepilogo salvabile **nella demo senza dati personali**, chiarendo che non è un preventivo definitivo.

## Cosa funziona già

- Hero e CTA chiariscono il servizio, con voce visiva coerente fra pagine; [home mobile a caricamento completato](/home/ubuntu/proemios-audit/mobile-home-settled.png).
- Menu mobile apre e mostra le destinazioni principali; [screenshot menu](/home/ubuntu/proemios-audit/mobile-menu.png).
- Configuratore: selezione, pulsanti disabilitati finché richiesto, anteprima prezzo e progressione fino all’ultimo passo osservati senza inviare dati.
- Moduli contatti e analisi presentano consenso marketing distinto e facoltativo; non ne ho verificato l’invio.
- Nessun overflow orizzontale nei viewport testati; 44 link interni controllati senza 404 pubblici. L’accesso a `/admin` è protetto con 401.
- I casi studio segnaposto sono esplicitamente dichiarati non reali, evitando testimonianze fittizie.

## Piano d’azione suggerito

1. **Subito (P1):** correggere contrasto delle label nell’analisi; decidere demo vs produzione e allineare tutti i metadati/domini; rendere coerenti banner, form e informative; rinominare l’accesso team o realizzare l’ingresso autore.
2. **Prossimo ciclo (P2):** assegnare nome accessibile allo slider, rendere navigabili le testimonianze, chiudere il menu con Escape, aumentare i contrasti minori; contestualizzare la CTA editor e ridurre i segnaposto della home.
3. **Ottimizzazione (P2/P3):** alleggerire i font, verificare animazioni e immagini, correggere landmark e ordine dei titoli; ritestare con utenti e dati di performance reali.

## Limiti

Questo è un **audit del front-end pubblico**, non un test del backend, un penetration test, una verifica legale della privacy né una certificazione WCAG. Non ho usato credenziali, inviato moduli, caricato manoscritti o confermato la consegna di email. Alcuni controlli automatici riguardano un campione di route; la sitemap contiene 40 URL, ma il crawl approfondito copre le 26 route collegate dalla home. La disponibilità DNS di `proemios.it` è stata verificata solo dall’ambiente di audit in questo momento. Le osservazioni sono riferite allo stato del sito del **6 ottobre 2026**.

**Evidenze tecniche disponibili:** [risultati route e axe](/home/ubuntu/proemios-audit/audit-results.json), [link interni](/home/ubuntu/proemios-audit/link-results.json), [Lighthouse mobile](/home/ubuntu/proemios-audit/lighthouse-mobile.json), [Lighthouse desktop](/home/ubuntu/proemios-audit/lighthouse-desktop.json).
