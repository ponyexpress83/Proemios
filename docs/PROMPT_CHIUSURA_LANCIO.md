# Prompt di chiusura: correzione del difetto e completamento del lancio

Data: 30/10/2026. Sostituisce `docs/PROMPT_COWORK_LANCIO.md` e tiene conto della verifica del 24 ottobre (`docs/LANCIO_2026-10-26_STATO.md`, PR #29) e dell'analisi per Alberto.

Il prompt ha tre parti, da usare in quest'ordine:

| Parte | Dove si incolla | Cosa chiude |
|---|---|---|
| **A** | una sessione di **Claude Code** sul repository `ponyexpress83/Proemios` | il difetto della versione Definitiva, l'unione della #29, i controlli sulle altre consegne, la documentazione |
| **B** | una conversazione di **Claude Cowork** con il browser collegato e l'accesso a Vercel, Neon, Stripe, Resend, GitHub (più Anthropic Console, Google Cloud e Fatture in Cloud se li usiamo) | i blocchi 2–15: staging, servizi, collaudo, account, produzione |
| **C** | da compilare con Alberto prima della Fase B4 | le decisioni operative e commerciali che il sistema aspetta |

La Parte B parte solo dopo che la Parte A è finita e la PR #27 è stata unita nella release con il mio sì.

## Stato di partenza (30/10/2026)

| Cosa | Stato |
|---|---|
| Produzione `proemios.vercel.app` | demo del 6 ottobre: commit `16fe696`, ramo predefinito `claude/kalamos-studio-phase-1-6z6xyw`, banner DEMO, `noindex`. Nessuna variabile *Production* su Vercel |
| Release `release/team-demo-2026-10-14` | CRM, contratti, pagamenti e Proemios 2.0 uniti (PR #26) |
| Ramo `claude/proemios-complete-v1-w78xtx` | release più caricamento diretto fino a 40 MB, soglie dei venditori e prompt di lancio (PR #27, bozza, CI verde) |
| Ramo `codex/proemios-launch-20261024` | correzione della Diagnostica sulle 11 tabelle dello Studio e rapporto del 24 ottobre (PR #29 verso il ramo `claude/…`, bozza, CI verde, 228 test su 228) |
| PR #28 | release → ramo predefinito, bozza, da unire solo dopo il collaudo |
| Anteprima più recente | build READY, ma risponde 503 su accesso e progetti: il ramo non ha database né servizi |
| Variabili Vercel | 8 record, solo *Preview* e legati a rami specifici (`release/…`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PROEMIOS_OWNER_EMAIL`) |
| Protezione Vercel | autenticazione Vercel su tutte le anteprime (`all_except_custom_domains`) |
| Neon | progetto di staging documentato `green-river-20539550` non raggiungibile dalla connessione usata il 24 ottobre |
| Dominio | `proemios.it` non collegato al progetto Vercel |
| Difetto aperto | nello Studio, «Approva come versione Definitiva» consegna DOCX e PDF al cliente senza controllare il saldo |

---

## Parte A: prompt per Claude Code

Sei lo sviluppatore di Proemios, piattaforma editoriale in Next.js 15, React 19, TypeScript, Drizzle su Postgres e Better Auth, nel repository `ponyexpress83/Proemios`. Devi correggere un difetto che blocca il lancio, integrare una correzione già pronta e preparare il codice per il collaudo. Non devi configurare servizi esterni né toccare la produzione: lo fa un'altra sessione.

### Regole

- **Ramo.** Lavora solo su `claude/proemios-complete-v1-w78xtx`. Spingi con `git push -u origin claude/proemios-complete-v1-w78xtx`.
- **Unioni.** Non unire PR e non spingere su `release/…` né sul ramo predefinito senza il mio sì esplicito in questa conversazione, dato per quella PR.
- **Funzioni.** Non eliminare funzioni esistenti. Se una va cambiata, conservane i dati e il comportamento finché non decido diversamente.
- **Regole economiche.** Non modificare prezzi, percentuali (`DEPOSIT_RATE` resta 0.4), contratti, testi legali o politiche commerciali.
- **Permessi.** Autorizzazione sempre lato server. Non ampliare i permessi predefiniti dei ruoli.
- **Segreti.** Nessun token o credenziale nel codice, nei log, nei test o nei commit.
- **Migrazioni.** Questa parte non richiede migrazioni. Se ti sembra che ne serva una, fermati e spiegami perché.
- **Commit.** Messaggi chiari in italiano; nessun nome di modello nei commit, nelle PR o nel codice.

### A0. Preparazione

1. `git fetch origin` e passa al ramo `claude/proemios-complete-v1-w78xtx`, allineato a `origin`.
2. `npm ci`.
3. Esegui `npm run typecheck`, `npm run lint` e `npm test` e annota il numero dei test che passano: è la base di confronto.
4. Leggi:
   - `lib/platform/documents/service.ts` (`approveVersion`, `storeGenerated`, `staffAccess`, `notifyClient`);
   - `lib/platform/projects.ts` (il blocco `body.stage === "delivered"` con `BALANCE_REQUIRED`, circa riga 240);
   - `lib/platform/commercial.ts` e `resolvePurchaseRule` in `lib/platform/crm.ts` (`balanceBeforeDelivery`, predefinito `true`);
   - `lib/platform/payments.ts`, circa riga 260: il preventivo passa a `stato = "won"` solo quando sono pagate tutte le quote, rate comprese;
   - `components/platform/studio-views.tsx` (circa riga 429: il modulo «Approva la versione» con la casella «Versione definitiva»);
   - `tests/studio.integration.test.ts` (il progetto di prova nasce con l'acconto pagato: il preventivo è in `deposit_paid`) e il test `BALANCE_REQUIRED` in `tests/platform.integration.test.ts` (circa riga 855).

### A1. Integrare la PR #29

1. Chiedimi il sì per unire la PR #29 (`codex/proemios-launch-20261024` → `claude/proemios-complete-v1-w78xtx`).
2. Con il sì, uniscila con un merge commit, senza squash né rebase. Poi aggiorna il ramo locale.
3. Ripeti typecheck, lint e test: devono passare tutti, compresi i 14 test di `tests/diagnostics-migrations.test.ts`.
4. Se non ricevi il sì, prosegui senza: la #29 si unirà dopo e non tocca i file della correzione.

### A2. Correggere il difetto della versione Definitiva

**Problema.** `approveVersion` con `final: true` e `deliver: true` crea i file DOCX e PDF di consegna, li rende visibili nell'area del cliente e lo avvisa, senza controllare il saldo. Il controllo esiste solo sul passaggio di fase «consegnato» in `projects.ts`. Così il cliente potrebbe ricevere il testo definitivo senza aver saldato.

**Regola da applicare**, identica a quella della fase «consegnato»: se il progetto nasce da un preventivo (`project.quoteId`) e la regola d'acquisto approvata ha `balanceBeforeDelivery` attivo, la versione Definitiva si consegna solo quando il preventivo è in `stato = "won"`. Altrimenti la richiesta si rifiuta con `409 BALANCE_REQUIRED` e lo stesso messaggio già in uso: «La consegna finale avviene dopo il saldo confermato. Il cliente trova il pagamento nella sua area.»

**Come implementarla:**

1. **Funzione condivisa.** Sposta il controllo in una funzione sola, ad esempio `assertBalanceForFinalDelivery(project)` in `lib/platform/projects.ts` o in un modulo vicino che non crei dipendenze circolari. Usala sia nel passaggio a «delivered» sia in `approveVersion`, senza duplicare la logica.
   - Il passaggio a «delivered» deve comportarsi esattamente come oggi: stesso codice, stesso messaggio, stesso ordine dei controlli (prima il saldo, poi `MISSING_DELIVERY`).
2. **In `approveVersion`.** Chiama il controllo quando `body.final && body.deliver`, **prima** di esportare il DOCX, generare il PDF e aprire la transazione. Una richiesta rifiutata non deve:
   - creare righe in `doc_versions` o in `project_files`;
   - salvare file nell'archivio;
   - chiudere cicli di revisione o cambiare la fase o lo stato del progetto;
   - avvisare il cliente.
3. **Cosa non si blocca:**
   - le versioni intermedie (V1, V2…, `final: false`), che restano consegnabili dopo l'acconto come prevede il contratto;
   - una Definitiva approvata **senza consegna** (`deliver: false`), che non espone nulla al cliente;
   - i progetti senza preventivo (`quoteId` nullo), come già succede per la fase «consegnato»;
   - i progetti per cui la regola approvata ha `balanceBeforeDelivery: false`.
4. **Proprietario.** Il blocco vale anche per il proprietario: nessuna eccezione per ruolo, come per la fase «consegnato».
5. **Registro.** Il rifiuto non deve lasciare un evento `document.version_approved`. Se il codice registra già i rifiuti in modo uniforme, segui quello schema; altrimenti non aggiungere nulla.
6. **Interfaccia** (`studio-views.tsx`):
   - la vista del documento per lo staff (`staffDocumentView`) espone un campo booleano, ad esempio `finalDeliveryAllowed`, calcolato con la stessa funzione: non ricalcolare la regola nel browser;
   - se il campo è falso, accanto alla casella «Versione definitiva» compare una nota breve: «La consegna definitiva si sblocca con il saldo confermato. Puoi approvarla senza consegnarla.»;
   - la casella resta usabile (serve per approvare senza consegna). Il server resta l'unico controllo: se l'invio viene rifiutato, mostra il messaggio d'errore del server come per gli altri errori del modulo.
7. **Test** in `tests/studio.integration.test.ts`, nella sezione delle versioni e consegne. Se la sequenza dei test esistenti dipende dalla fase del progetto, aggiungili in un `describe` con il proprio preventivo:
   1. preventivo in `deposit_paid`, Definitiva con consegna → 409 `BALANCE_REQUIRED`; nessuna nuova riga in `doc_versions` né in `project_files` di tipo consegna; nessuna nuova notifica al cliente; fase e stato del progetto invariati;
   2. stesso stato, versione intermedia con consegna → 201 e consegna visibile al cliente;
   3. stesso stato, Definitiva **senza** consegna → 201 e nessun file per il cliente;
   4. preventivo in `won` (il saldo si simula come negli altri test, con l'evento Stripe firmato o aggiornando lo stato come fa il test esistente) → Definitiva con consegna 201, file visibili e notifica al cliente;
   5. regola approvata con `balanceBeforeDelivery: false` → Definitiva consegnata anche con preventivo in `deposit_paid`; alla fine ripristina la regola, come fa il test esistente;
   6. il test esistente su `BALANCE_REQUIRED` nel passaggio a «delivered» deve passare senza modifiche;
   7. la vista staff espone `finalDeliveryAllowed` falso prima del saldo e vero dopo.
8. Esegui di nuovo tutta la suite: nessuna regressione rispetto alla base di A0.

### A3. Controllare le altre strade di consegna (solo verifica, salvo difetti uguali)

Verifica, leggendo il codice e con un test dove serve, che nessun'altra strada faccia arrivare il testo **definitivo** al cliente prima del saldo:

1. caricamento manuale di un file di consegna (`kind: "delivery"`) da parte dello staff in `projects.ts`: è il vecchio flusso delle consegne di revisione, permesso prima del saldo. Riportami come si distingue oggi una consegna definitiva da una intermedia in quel flusso;
2. condivisione del documento Google con il cliente (`lib/platform/documents/google.ts`): il cliente legge il testo di lavoro. Riportami se succede prima del saldo e con quali permessi;
3. area del cliente (`lib/platform/documents/revisions.ts`): le versioni `final` e `delivery` con file sono scaricabili. Conferma che, dopo la correzione, una `final` con file esiste solo a saldo avvenuto;
4. rate: con un saldo a rate il preventivo passa a `won` solo all'ultima rata. Conferma che è il comportamento voluto per la consegna definitiva;
5. rimborso o contestazione del saldo dopo la consegna: cosa succede allo stato del preventivo e ai file già consegnati. Solo verifica: non cambiare nulla.

Se trovi una strada che consegna la Definitiva senza saldo, correggila con la stessa funzione e aggiungi un test. Per tutto il resto scrivimi un paragrafo per punto, senza modificare il codice.

### A4. Punti che dipendono dalle decisioni della Parte C

Implementali solo se nella Parte C c'è una decisione scritta. Altrimenti non toccarli e riportali come «in attesa di decisione».

1. **Una sola strada per le revisioni** (Parte C, decisione R2). Oggi il cliente può chiedere modifiche dal pulsante «Chiedi una revisione» sulle consegne (`components/author/real-workspace.tsx`, circa riga 230, `files/:id/approval` con `changes_requested`) e dal riquadro «Il tuo testo» (cicli contati in `lib/platform/documents/revisions.ts`). Se la decisione è «una sola strada»:
   - per i progetti che hanno un documento nello Studio, sostituisci il pulsante con un collegamento al riquadro «Il tuo testo», che conta i cicli;
   - per i progetti senza documento nello Studio, il pulsante resta com'è;
   - non cancellare l'endpoint, le approvazioni già registrate né i dati;
   - aggiungi i test: con documento il cliente viene indirizzato al riquadro; senza documento il flusso vecchio funziona come oggi.
2. **Responsabile di produzione predefinito** (decisione P1). Se la decisione è «sempre Alberto», non serve codice: Alberto accetta i passaggi e diventa responsabile del progetto (`crm-handoff.ts`, `coalesce` su `opsLeadId`). Se invece si vuole un responsabile predefinito anche quando il passaggio lo accetta un coordinatore, proponimi la modifica senza implementarla: è una regola nuova e la approvo io.
3. **Approvazione tacita dopo 15 giorni.** È un testo legale (`app/termini/page.tsx` e `lib/platform/contracts.ts`): non toccarlo. Il sistema non applica alcuna approvazione automatica e così deve restare.

### A5. Documentazione

Aggiorna in modo breve e preciso, senza dichiarare verificato ciò che è solo testato in locale:

- `docs/PROEMIOS_DOCUMENT_STUDIO.md` e `docs/PROEMIOS_EDITOR_AI.md`: la Definitiva si consegna solo a saldo confermato (quando la regola è attiva); le versioni intermedie no;
- `docs/PERCORSO_DI_ACQUISTO.md`: la stessa regola nel passo della consegna finale;
- `docs/PROEMIOS_COLLAUDO.md`: aggiungi lo scenario «Definitiva prima e dopo il saldo» tra quelli da ripetere su staging;
- `docs/PROEMIOS_GO_LIVE.md`: nessun passo nuovo, solo il rimando a questo prompt se manca;
- l'esito di A3, in una sezione «Strade di consegna» di `docs/PROEMIOS_DOCUMENT_STUDIO.md`.

### A6. Verifica prima di spingere

1. `npm run typecheck`, `npm run lint`, `npm test`: tutto verde, con un numero di test pari alla base di A0 più quelli nuovi.
2. `npm run build`: la build deve completarsi. Se si ferma solo nella pulizia finale (`ENOTEMPTY`), scrivilo e non cambiare la configurazione per nasconderlo.
3. Rileggi il diff come un revisore severo:
   - il controllo del saldo è **prima** di qualunque scrittura;
   - nessun ruolo lo aggira;
   - il passaggio a «delivered» è invariato;
   - nessun permesso è cambiato;
   - nessun prezzo o regola economica è cambiata.
4. Commit separati: uno per la correzione con i suoi test, uno per la documentazione, ed eventualmente uno per ogni punto di A4. Poi spingi.
5. Aggiorna la descrizione della PR #27: cosa corregge, come l'hai provato, cosa resta da verificare su staging. Lasciala in bozza.
6. Controlla che la CI sulla PR #27 diventi verde. Se fallisce, trova la causa e correggila; non disattivare test.

### A7. Cosa mi riporti alla fine

- Una riga per ogni punto da A1 ad A6, con esito e prova (comando e risultato, o test).
- Il numero di test prima e dopo.
- L'elenco dei commit spinti e il link alla PR #27.
- L'esito di A3, punto per punto.
- I punti di A4 implementati o in attesa di decisione.
- Le PR che restano da unire, in ordine: #29 (se non unita), #27 → release, poi #28 dopo il collaudo. Non unire nulla senza il mio sì.

---

## Parte B: prompt per Claude Cowork

Sei il mio assistente operativo per il lancio di Proemios, piattaforma editoriale (sito, preventivi, contratti, pagamenti, CRM, produzione con AI e revisioni dei clienti). Il codice è nel repository `ponyexpress83/Proemios`.

- Il codice da collaudare è il ramo `release/team-demo-2026-10-14`, **dopo** che vi ho unito la PR #27.
- La produzione pubblica il ramo predefinito `claude/kalamos-studio-phase-1-6z6xyw`: oggi è la demo del 6 ottobre.

Il tuo lavoro:
1. preparare e collaudare **staging** (l'anteprima del ramo release) con dati e pagamenti di prova;
2. raccogliere le mie decisioni e quelle del responsabile operativo Alberto;
3. creare gli account del team;
4. preparare il passaggio in produzione, che si esegue **solo con il mio sì esplicito, passo per passo**.

**Non scrivere codice e non modificare file nel repository.** Fanno eccezione le PR che ti indico (pianificatore su GitHub Actions). Se trovi un difetto, fermati e descrivimelo con i passi per riprodurlo: lo correggo in una sessione di Claude Code.

### Documenti da leggere prima di iniziare

Leggili sul ramo `release/team-demo-2026-10-14`:
- `docs/LANCIO_2026-10-26_STATO.md`: la verifica del 24 ottobre e i 13 blocchi;
- `docs/PROEMIOS_GO_LIVE.md`: passi, variabili, ritorno indietro;
- `docs/PROEMIOS_COLLAUDO.md` e `docs/CRM_COLLAUDO.md`: scenari di collaudo;
- `docs/PROEMIOS_INTEGRAZIONI.md`: servizi esterni e come si verificano;
- `docs/PROEMIOS_ACCOUNT_E_PERMESSI.md`: modelli di ruolo e inviti;
- `docs/PROEMIOS_AUDIT_COMPLETO.md`: stato di GitHub, Vercel e Neon;
- `docs/CRM_MESSA_IN_USO_2026-10-17.md`: decisioni del CRM ancora aperte.

### Regole che non si discutono

- **Produzione.** Non modificare variabili *Production* e non promuovere deployment, migrazioni in produzione, unioni nel ramo predefinito o modifiche ai domini senza il mio sì esplicito in questa conversazione, dato per quel passo.
- **Ramo di produzione.** Non cambiare il ramo di produzione di Vercel né il ramo predefinito di GitHub.
- **Database.** Mai una migrazione senza un ramo Neon di backup creato e letto prima. Mai `db:push`. Non sostituire un database esistente con uno nuovo per aggirare un problema di accesso. Non cancellare database, rami, progetti o dati.
- **Destinatari.** Niente email, inviti o messaggi a persone reali, salvo quelle dell'elenco che ti darò io. Per le prove usa caselle che controllo io.
- **Pagamenti.** Su staging solo Stripe in **Test mode** con la carta `4242 4242 4242 4242`. Mai chiavi `sk_live_` su staging.
- **Fatture.** Su staging Fatture in Cloud resta scollegato. In produzione `FIC_SEND_TO_SDI` resta spento finché il commercialista non ha controllato la prima fattura.
- **Costi.** Non attivare piani a pagamento e non acquistare servizi. Proponi l'opzione con il costo letto sulla pagina ufficiale e aspetta la mia decisione. Per Anthropic imposta un limite di spesa basso (lo decido io) prima di creare la chiave.
- **Segreti.** Non copiarli in chat, documenti, commenti o file del repository. Si incollano solo nei campi delle variabili d'ambiente o dei segreti. Generali casuali e lunghi (almeno 32 caratteri).
- **Valori aziendali.** Non inventare prezzi, percentuali, regime IVA, cicli di revisione, tetti di spesa AI, cambio USD→EUR, orari, competenze o sconti. Li prendi dalla Parte C o te li do io; altrimenti restano «da completare». Non copiare i valori dei test.
- **Testi legali.** Non pubblicare né modificare termini, privacy o cookie: mi prepari le bozze, le approvo io o il mio legale.
- **DNS.** Prima di cambiare record mostrami i record attuali e quelli nuovi, esatti, e aspetta la mia conferma.
- **Stato dichiarato.** «Verificato» solo se la Diagnostica dell'app o un fatto concreto lo dimostra (un evento firmato ricevuto, una email consegnata, una chiamata AI riuscita). Una variabile impostata o una build READY non sono prove.

### Fase B0: accessi e ambiente da collaudare

1. **Codice.** Su GitHub controlla che la PR #27 sia unita nella release e annota il commit di testa del ramo `release/team-demo-2026-10-14`. Se non lo è, fermati e dimmelo.
2. **Neon (blocco 2).** Ripristina l'accesso al progetto di staging `green-river-20539550`: account Neon giusto, organizzazione, inviti.
   - Se il progetto non esiste più o non è recuperabile, fermati e proponimi le alternative. Non crearne uno nuovo senza il mio sì.
   - Una volta dentro, leggi l'elenco delle tabelle e la tabella `drizzle.__drizzle_migrations`: dimmi quali migrazioni risultano applicate, senza riportare la stringa di connessione.
   - Controlla che non sia lo stesso database della produzione: confronta solo host e nome, senza riportarli interi.
3. **Backup.** Crea un ramo Neon di backup del database di staging, con la data nel nome (ad esempio `backup-staging-2026-10-30`). Esegui una lettura di prova (conteggio delle righe di `user` e `projects`) e annota l'esito.
4. **Anteprima stabile.** Su Vercel, progetto `proemios`, trova l'indirizzo stabile del ramo release (l'alias del ramo, non quello del singolo deployment) e annotalo come `<STAGING>`.
5. **Protezione delle anteprime.** Le anteprime richiedono l'accesso a Vercel. Il webhook di Stripe, il pianificatore e i link nelle email di prova non possono superarlo da soli. Proponimi una delle tre opzioni e aspetta la mia scelta:
   - **a.** «Protection Bypass for Automation»: un segreto che Stripe e il pianificatore aggiungono alla chiamata (parametro `x-vercel-protection-bypass`). Le persone di prova devono comunque entrare in Vercel;
   - **b.** un dominio di staging (ad esempio `staging.proemios.it`) collegato al ramo release: le anteprime con dominio proprio non hanno la protezione. Serve un record DNS: mostramelo prima;
   - **c.** protezione disattivata solo sulle anteprime per la durata del collaudo. È la più semplice, ma espone le anteprime a chiunque abbia il link.
   Per il collaudo consiglio **b**, perché somiglia di più alla produzione e serve anche a provare email e link.

### Fase B1: variabili di staging e migrazioni (blocco 3)

1. **Ambito delle variabili.** Oggi le variabili *Preview* sono legate a rami specifici. Imposta quelle sotto con ambito *Preview* sul **solo ramo** `release/team-demo-2026-10-14`. Non toccare quelle degli altri rami e non creare variabili *Preview* generali senza dirmelo.
2. **Variabili di base:**

| Variabile | Cosa metterci |
|---|---|
| `DATABASE_URL` | database di staging verificato in B0 (già presente: controlla che punti lì) |
| `BETTER_AUTH_SECRET` | già presente: lascialo com'è, se c'è |
| `APP_URL` | `https://<STAGING>`, deve essere HTTPS: è l'indirizzo usato nei link delle email |
| `PROEMIOS_OWNER_EMAIL` | già presente: controlla che sia la mia email da proprietario |
| `CRON_SECRET` | valore casuale lungo |
| `EDITORIAL_AI_ENABLED` | `0` fino alla Fase B5 |

   **Non** impostare `PROEMIOS_PRODUCTION_READY`, `DEMO_MODE`, `PROEMIOS_STAGING_PASSWORD_ONLY` o `FIC_*` su questo ramo.
3. **Migrazioni.** Solo dopo il backup di B0:
   - aggiungi `RUN_MIGRATIONS_ON_PREVIEW=1` con ambito *Preview* sul solo ramo release;
   - controlla che il «Build Command» del progetto non sia personalizzato e usi lo script `vercel-build`;
   - fai il redeploy e cerca nei log «Migrazioni dell'anteprima aggiornate»;
   - poi rimuovi `RUN_MIGRATIONS_ON_PREVIEW` e fai un nuovo redeploy.
4. **Controllo.** `GET https://<STAGING>/api/auth/get-session` non deve più rispondere 503.
5. **Diagnostica.** Entra come proprietario: al primo accesso attiva il codice nell'app di autenticazione. Apri Impostazioni CRM → Diagnostica:
   - «Database» e «Migrazioni» devono essere «Verificato», con la `0014_document_studio` applicata;
   - riportami lo stato di ogni voce, senza segreti.

### Fase B2: email, pagamenti, archivio e scanner (blocchi 4, 5 e 6)

1. **Email (Resend).**
   - Controlla in Resend se il dominio di invio è verificato. Se non lo è, mostrami i record DNS richiesti e aspetta la mia conferma.
   - Imposta `RESEND_API_KEY`, `EMAIL_FROM` (un indirizzo del dominio verificato) ed `EMAIL_INTERNAL` (la casella del team per gli avvisi interni, la decido io).
   - Prova su caselle che controllo io: registrazione con verifica email, recupero della password, invito di un membro del team. Per ognuna dimmi se è arrivata, in quanto tempo e se il link apre `<STAGING>`.
2. **Pagamenti (Stripe, Test mode).**
   - Imposta `STRIPE_SECRET_KEY` (chiave di test) e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (di test).
   - Crea il webhook di test verso `https://<STAGING>/api/webhooks/stripe`, con gli eventi elencati in `docs/CRM_COLLAUDO.md`. Se hai scelto l'opzione **a** di B0.5, aggiungi il parametro di bypass all'indirizzo.
   - Imposta `STRIPE_WEBHOOK_SECRET` e fai il redeploy.
   - Verifica che in Stripe gli eventi risultino consegnati con risposta 200.
3. **Archivio privato (Vercel Blob).** Collega uno store Blob **privato** al progetto per il ramo release e controlla che `BLOB_READ_WRITE_TOKEN` sia presente. Serve anche al caricamento diretto dei file tra 4 e 40 MB.
4. **Scanner dei file.** Senza scanner i clienti possono caricare solo TXT: DOCX e PDF vengono rifiutati.
   - L'app chiama `FILE_SCANNER_URL` (`https://`) con `POST`, intestazione `Authorization: Bearer <FILE_SCANNER_TOKEN>` e il file come corpo `application/octet-stream`, e si aspetta JSON `{"clean": true}` oppure `{"clean": false}`.
   - Proponimi 2–3 servizi con costo, regione dei dati (UE preferita) e conservazione dei file.
   - Se il formato del servizio scelto è diverso, dimmelo: preparo un adattatore in Claude Code. **Non** impostare uno scanner finto.
   - Dopo la mia scelta imposta le due variabili. Prova un DOCX innocuo, un PDF tra 5 e 40 MB (caricamento diretto) e il file di prova EICAR, se il servizio lo prevede: DOCX e PDF devono risultare «disponibili», EICAR «respinto».
5. **Diagnostica.** Email, Stripe, Blob e scanner devono risultare «Verificato» o, se la Diagnostica non lo prevede, provati con i fatti sopra.

### Fase B3: automazioni (blocco 7)

1. Serve una chiamata ogni 10–15 minuti a `/api/cron/frequent`, che comprende anche la coda AI, oltre a quella giornaliera a `/api/cron`. Proponimi le due opzioni gratuite e procedi con quella che scelgo:
   - **cron-job.org**: GET con `Authorization: Bearer <CRON_SECRET>` (e il bypass se hai scelto l'opzione **a**). Chiedimi prima di creare l'account;
   - **GitHub Actions**: il file `.github/workflows/crm-frequent-cron.yml` funziona solo sul ramo predefinito. Serve una PR che lo porti lì, da approvare io, più i segreti del repository `CRON_URL` (`https://<STAGING>/api/cron/frequent`) e `CRON_SECRET`.
2. Dopo 30 minuti, Impostazioni CRM → Attività automatiche deve mostrare «Manutenzione frequente: in regola». Controlla anche che non ci siano esecuzioni doppie o errori.

### Fase B4: decisioni e configurazione (blocco 8)

1. Apri la Configurazione CRM e leggimi «Decisioni aziendali ancora da prendere», con le proposte già presenti. Prima di chiedere nuovi valori, leggi le regole già approvate.
2. Usa i valori decisi nella Parte C. Per quelli che mancano, chiedimeli un gruppo alla volta:
   - flussi, marchio ed email di assistenza;
   - catalogo dei pacchetti;
   - orari e tempi di risposta;
   - attribuzione e percentuali provvigionali;
   - regime IVA e condizioni di pagamento (dal commercialista);
   - regola d'acquisto: servizi acquistabili subito, partenza dopo acconto o saldo, rate, `balanceBeforeDelivery`, sconti dei venditori.
3. In Impostazioni CRM → **AI, costi e revisioni**: modello, impegno, tetto per lavorazione e mensile, avvio automatico delle revisioni incluse, assistente commerciale, cambio USD→EUR, cicli di revisione inclusi per servizio.
4. In Impostazioni CRM → **Home venditori**: soglie (proposta: 48 ore, 3 giorni, 24 ore, 7 giorni).
5. Ogni valore si inserisce con «Vedi cosa cambia» → controllo → «Approva e salva». Alla fine mostrami lo stato della Configurazione CRM: nessuna voce deve restare «da completare», salvo quelle che decido di rimandare.

### Fase B5: AI e Google su staging (blocco 10)

1. **Anthropic.** Solo dopo la mia conferma su termini e trattamento dei dati:
   - nella Console crea una chiave dedicata a staging, con il limite di spesa che ti indico;
   - imposta `ANTHROPIC_API_KEY` ed `EDITORIAL_AI_ENABLED=1` sul ramo release e fai il redeploy;
   - in Impostazioni CRM → AI, costi e revisioni controlla che il listino interno dei prezzi coincida con la pagina ufficiale dei prezzi di Anthropic per il modello scelto. Se non coincide, fermati: lo correggo in Claude Code;
   - fai una lavorazione di prova su un testo sintetico (nessun manoscritto reale): deve produrre proposte e un costo visibile nella Cabina di regia.
2. **Google Docs (facoltativo, solo se lo decido).**
   - Crea un client OAuth «Web» nel progetto Google Cloud che ti indico e abilita le API Docs e Drive.
   - URI di ritorno: `https://<STAGING>/api/integrations/google/callback`.
   - Imposta `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
   - Collega un account Google di prova da Impostazioni CRM → Diagnostica.

### Fase B6: account di prova e collaudo completo (blocco 9)

1. **Account di prova**, su caselle che controllo io:
   - proprietario;
   - due venditori;
   - un responsabile di produzione, con il modello «Responsabile produzione»;
   - un coordinatore;
   - due editor (uno interno e un collaboratore esterno);
   - un'amministrazione (Finance);
   - un marketing;
   - due clienti.

   Inviti da Persone e accessi con il modello di ruolo giusto. Credenziali e URI `otpauth` solo in un file locale sul mio computer: mai nel repository né in chat.
2. **Collaudo del CRM.** Segui `docs/CRM_COLLAUDO.md`, scenari A–F. Se hai un terminale usa `node scripts/collaudo-crm.mjs avvia` e poi `node scripts/collaudo-crm.mjs dopo-pagamento`, con `VERCEL_PROTECTION_BYPASS` se hai scelto l'opzione **a**.
3. **Collaudo della produzione.** Segui `docs/PROEMIOS_COLLAUDO.md` («Da ripetere su staging»), seguendo il percorso del cliente in 16 passi:
   1. richiesta dal sito → contatto assegnato a un venditore e avviso;
   2. registrazione del cliente e verifica email;
   3. proposta del venditore (lo sconto oltre il limite deve essere rifiutato);
   4. conferma, contratto, 4 accettazioni, contratto PDF via email;
   5. acconto con la carta di test → un solo progetto, anche se il webhook arriva due volte;
   6. pagamento fallito e pagamento abbandonato → compaiono in «Le mie vendite» del venditore;
   7. caricamento di un DOCX sintetico e di un PDF tra 5 e 40 MB;
   8. passaggio alla produzione: il venditore lo prepara, il responsabile lo accetta e diventa responsabile del progetto;
   9. assegnazione di un editor: prima dell'assegnazione non vede i file, dopo sì;
   10. importazione nello Studio e lavorazione AI di correzione bozze (se B5 fatta) → avviso all'editor con il link e costo nella Cabina di regia;
   11. accettazione e rifiuto delle proposte ed esportazione del DOCX con revisioni. **Aprilo in Microsoft Word** (o in Google Docs) e verifica che le revisioni si accettino e si rifiutino;
   12. controllo qualità da parte di una seconda persona: durante il controllo consegna solo lei;
   13. consegna della V1 → il cliente la vede e riceve l'avviso;
   14. richiesta di revisione del cliente da «Il tuo testo» → conteggio dei cicli, decisione del responsabile, nuova lavorazione, consegna della V2;
   15. **Definitiva prima del saldo**: «Approva come versione Definitiva» con consegna deve essere rifiutata con il messaggio sul saldo, e il cliente non deve ricevere nulla. Approvarla senza consegna deve riuscire;
   16. saldo con la carta di test → fattura non emessa (Fatture in Cloud scollegato), preventivo concluso; poi la Definitiva con consegna riesce e il progetto passa a «consegnato».
4. **Sicurezza e permessi.**
   - Un cliente non vede i progetti dell'altro.
   - Un venditore non vede i clienti del collega né i manoscritti.
   - Finance non vede i manoscritti.
   - Il marketing non vede fatture né manoscritti.
   - Un editor non assegnato non apre il documento.
   - Il team senza codice non entra.
   - La revoca delle sessioni chiude l'accesso.
5. **Provvigioni.** Dopo l'acconto la provvigione risulta «maturata» per il venditore giusto. Dopo un rimborso di prova risulta «trattenuta» o «rettificata».
6. **Rimborso.** Lo prepara una persona e lo autorizza un'altra; il denaro si muove solo tramite Stripe in Test mode.
7. **Assistente commerciale**, se attivato: su una trattativa di prova deve restituire solo una bozza, senza invio.

Per ogni scenario scrivi «verificato» o «non verificato» con il motivo, più screenshot senza dati personali.

### Fase B7: testi legali (blocco 12)

Preparami in bozza, senza pubblicarli, e indicami cosa deve rivedere un legale:
1. l'aggiornamento della privacy: Anthropic (e Google, se usato) come fornitori che trattano i testi, lo scanner e la conservazione dei manoscritti;
2. le condizioni sui cicli di revisione, sugli extra e sulla consegna definitiva dopo il saldo;
3. la clausola dell'approvazione tacita dopo 15 giorni (`app/termini/page.tsx`), segnalata come contestabile verso i consumatori: proponi una versione alternativa;
4. la pagina cookie, se attiviamo GA4.

### Fase B8: account reali del team (blocco 13)

1. Quando ti do l'elenco delle persone reali, invitale **nell'ambiente che ti indico** con il modello di ruolo della Parte C. Per Alberto: «Responsabile produzione».
2. Per ognuno fammi confermare competenze, lingue, capacità e limiti di sconto, persona per persona: il sistema non li deduce.
3. Controlla che ognuno abbia attivato il codice al primo accesso. Riportami una tabella con persona, ruolo, codice attivo sì/no e profilo completo sì/no.

### Fase B9: produzione (blocco 14, ogni passo solo con il mio sì)

Preparami prima la lista completa e aspetta l'approvazione passo per passo:

1. **Database di produzione.** Deve essere distinto da quello di staging. Crea un ramo Neon di backup e prova a leggerlo.
2. **Migrazioni.** Una volta e a mano: `npm run db:migrate` con il `DATABASE_URL` di produzione, da un terminale sicuro. `RUN_MIGRATIONS_ON_PREVIEW` in produzione blocca la build: non va impostata.
3. **Dominio.** Aggiungi `proemios.it` (ed eventualmente `www`) al progetto Vercel. Mostrami i record DNS attuali e quelli richiesti e aspetta la mia conferma. Dopo la propagazione verifica HTTPS e che un visitatore anonimo, senza accesso a Vercel, apra il sito.
4. **Variabili *Production*:**
   - `DATABASE_URL`, `BETTER_AUTH_SECRET` (nuovo, diverso da staging), `APP_URL=https://proemios.it`, `PROEMIOS_OWNER_EMAIL`, `CRON_SECRET` (nuovo);
   - Stripe live: chiave, chiave pubblicabile e webhook live su `https://proemios.it/api/webhooks/stripe`;
   - Resend (`RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_INTERNAL`), Blob privato, scanner;
   - Fatture in Cloud (`FIC_*`) solo se la fatturazione automatica è decisa, con `FIC_SEND_TO_SDI` spento;
   - Anthropic con chiave e limite di produzione, ma `EDITORIAL_AI_ENABLED=0` finché le regole non sono approvate in produzione;
   - Google, se usato: un nuovo URI di ritorno su `https://proemios.it/api/integrations/google/callback`.
5. **Pianificatore** puntato a `https://proemios.it`.
6. **Protezione del ramo predefinito.** Prima dell'unione consiglio PR obbligatoria e controllo `verify` verde.
7. **Unione del codice.** Unisci la PR #28 (release → ramo predefinito) **solo con il mio sì**, controllando prima che contenga il commit di testa della release collaudata.
8. **Controlli dopo la pubblicazione:**
   - Diagnostica in produzione;
   - configurazione approvata anche in produzione (le regole di staging non si copiano da sole);
   - un acquisto reale di importo minimo, solo se lo decido io, con rimborso;
   - una lavorazione AI su un testo interno e il costo nella Cabina di regia, poi `EDITORIAL_AI_ENABLED=1` se lo decido;
   - prima fattura controllata dal commercialista, poi `FIC_SEND_TO_SDI=1` se lo decido.
9. **Ritorno indietro.** Tieni pronti i passi di `docs/PROEMIOS_GO_LIVE.md` §3: pausa AI, deployment precedente, ripristino dal ramo Neon.

### Fase B10: indicizzazione (blocco 15)

Solo a checklist completata e con il mio sì:
1. imposta `PROEMIOS_PRODUCTION_READY=1` in *Production* e fai il redeploy;
2. verifica sul dominio definitivo:
   - `robots.txt` senza `Disallow: /`;
   - sitemap raggiungibile;
   - canonical su `https://proemios.it`;
   - nessun meta `noindex`;
   - nessun banner DEMO.

### Formato dei tuoi aggiornamenti

Alla fine di ogni fase mandami una tabella con quattro colonne: «Operativo e verificato», «Configurato ma non verificato», «Da collegare», «Da decidere». Per ogni riga indica dove l'hai visto: Diagnostica, log di build, Stripe, Neon, Resend o altro.

Tieni aggiornato anche l'elenco dei 15 blocchi, con stato e prova:

| # | Blocco | Fase |
|---|---|---|
| 1 | Saldo non controllato sulla Definitiva | Parte A |
| 2 | Accesso a Neon di staging | B0 |
| 3 | Anteprima senza database e servizi | B1 |
| 4 | Email | B2 |
| 5 | Pagamenti | B2 |
| 6 | Scanner e archivio privato | B2 |
| 7 | Automazioni | B3 |
| 8 | Decisioni aziendali | B4 e Parte C |
| 9 | Collaudo completo | B6 |
| 10 | AI editoriale | B5 |
| 11 | Fatturazione automatica | B9, con il commercialista |
| 12 | Testi legali | B7, con il legale |
| 13 | Account reali del team | B8 |
| 14 | Produzione | B9 |
| 15 | Indicizzazione | B10 |

Alla fine elenca i difetti trovati, con i passi per riprodurli, pronti da passare a Claude Code.

---

## Parte C: decisioni da prendere con Alberto

Una riga per decisione. Le proposte sono quelle attive oggi nel codice o nelle impostazioni: non sono scelte già approvate. Compila la colonna «Decisione» e passala a Claude Code (A4) e a Cowork (B4).

| Codice | Decisione | Proposta attuale | Decisione |
|---|---|---|---|
| P1 | Chi accetta il passaggio dalla vendita alla produzione (chi lo accetta diventa responsabile del progetto e riceve gli avvisi) | Alberto, con il modello «Responsabile produzione» | |
| P2 | Il lavoro parte con l'acconto per tutti i servizi, o per alcuni dopo il saldo | con l'acconto del 40% | |
| P3 | Competenze, lingue e capacità di ogni editor e collaboratore | da inserire | |
| P4 | Servizi con controllo qualità obbligatorio di una seconda persona, e chi lo fa | facoltativo, deciso progetto per progetto | |
| P5 | Formati accettati e dimensione massima dei file | TXT, DOCX e PDF fino a 40 MB | |
| A1 | Servizi con lavorazione AI, tetto per lavorazione e al mese | 15 $ e 300 $ | |
| A2 | Una revisione inclusa può avviare l'AI da sola | sì nella proposta delle regole; finché le regole non sono approvate decide una persona | |
| R1 | Cicli di revisione inclusi per ciascun servizio | non indicati: ogni richiesta la valuta il responsabile | |
| R2 | Una sola strada per chiedere revisioni («Il tuo testo») o anche il vecchio pulsante sulla consegna | entrambe | |
| R3 | Approvazione tacita dopo 15 giorni nelle condizioni | presente nel testo, non applicata dal sistema; da sentire il legale | |
| C1 | La Definitiva si consegna solo dopo il saldo | sì (`balanceBeforeDelivery` attivo), esteso allo Studio dalla Parte A | |
| C2 | Chi registra compenso dell'editor e altri costi di progetto | Finance | |
| C3 | Promemoria al cliente | materiali dopo 3 e 10 giorni; consegna senza risposta dopo 3 e 7 giorni | |
| C4 | Rate del saldo che un venditore può concedere da solo | 1 (nessuna rata) | |
| C5 | Sconto massimo del venditore senza approvazione | 0% | |
| S1 | Servizi facoltativi al lancio: Google Docs, Brevo, GA4, assistente commerciale, API esterne | spenti | |
| S2 | Fatturazione automatica su Fatture in Cloud al lancio | da decidere con il commercialista | |
