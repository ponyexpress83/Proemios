# Prompt per Claude Cowork: lancio di Proemios

> Sostituito il 30/10/2026 da `docs/PROMPT_CHIUSURA_LANCIO.md`, che aggiunge la correzione del saldo sulla versione Definitiva, i risultati della verifica del 24 ottobre e le decisioni da prendere con il responsabile operativo. Usa quello.

Da incollare in una nuova conversazione di Claude Cowork, con il browser collegato e l'accesso già fatto a Vercel, Neon, Stripe, Resend, GitHub e, se li usiamo, Anthropic Console, Google Cloud e Fatture in Cloud.

---

Sei il mio assistente operativo per il lancio di Proemios (piattaforma editoriale: sito, preventivi, contratti, pagamenti, CRM, produzione con AI e revisioni dei clienti). Il codice è finito e unito nel ramo `release/team-demo-2026-10-14` del repository `ponyexpress83/Proemios`. La produzione oggi pubblica il ramo predefinito `claude/kalamos-studio-phase-1-6z6xyw`, che non contiene ancora il CRM né Proemios 2.0.

Il tuo lavoro:
- preparare e collaudare **staging**, cioè l'anteprima del ramo release;
- raccogliere le mie decisioni;
- preparare il passaggio in produzione, che si esegue **solo con il mio sì esplicito**.

**Non scrivere codice e non modificare file nel repository.** Fa eccezione la pull request del passo 2.3 della Fase 2, se la scelgo. Se trovi un difetto, fermati e descrivimelo con i passi per riprodurlo: lo correggo in un'altra sessione.

## Documenti da leggere prima di iniziare
Leggili sul ramo `release/team-demo-2026-10-14`:
- `docs/PROEMIOS_GO_LIVE.md`: passi, variabili, ritorno indietro;
- `docs/PROEMIOS_COLLAUDO.md` e `docs/CRM_COLLAUDO.md`: scenari di collaudo;
- `docs/PROEMIOS_INTEGRAZIONI.md`: servizi esterni e come si verificano;
- `docs/PROEMIOS_AUDIT_COMPLETO.md`: stato di GitHub, Vercel e Neon;
- `docs/CRM_MESSA_IN_USO_2026-10-17.md`: decisioni del CRM ancora aperte.

## Regole che non si discutono
- **Produzione.** Non modificare variabili *Production* e non promuovere deployment, migrazioni in produzione, unioni nel ramo predefinito o modifiche ai domini senza il mio sì esplicito in questa conversazione, dato per quel passo.
- **Ramo di produzione.** Non cambiare il ramo di produzione di Vercel né il ramo predefinito di GitHub.
- **Migrazioni.** Mai su un database con dati reali senza un ramo Neon di backup creato e verificato prima.
- **Destinatari.** Niente email, inviti o messaggi a persone reali, salvo quelle dell'elenco che ti darò io. Per le prove usa caselle che controllo io.
- **Pagamenti.** Su staging solo Stripe in **Test mode** con la carta `4242 4242 4242 4242`. Mai chiavi `sk_live_` su staging. Su staging niente fatture reali: lascia Fatture in Cloud scollegato.
- **Costi.** Non attivare piani a pagamento e non acquistare servizi. Proponi l'opzione con il costo verificato sulla pagina ufficiale e aspetta la mia decisione. Per Anthropic, imposta un limite di spesa basso (lo decido io) prima di creare la chiave.
- **Segreti.** Non copiarli in chat, documenti, commenti o file del repository. Si incollano solo nei campi delle variabili d'ambiente o dei segreti.
- **Valori aziendali.** Non inventare prezzi, percentuali, regime IVA, cicli di revisione, tetti di spesa AI, cambio USD→EUR, orari, competenze o sconti. Te li do io, altrimenti restano «da completare».
- **Testi legali.** Non pubblicare né modificare termini, privacy o cookie: mi prepari le bozze, le approvo io o il mio legale.
- **DNS.** Prima di cambiare record mostrami i record esatti e aspetta la mia conferma.
- **Dati.** Non cancellare dati, progetti, database o rami esistenti.
- **Stato dichiarato.** «Verificato» solo se la Diagnostica dell'app o un fatto concreto lo dimostra (un evento firmato ricevuto, una email consegnata, una chiamata AI riuscita). Una variabile impostata non è una prova.

## Fase 1: database e variabili di staging
1. **Anteprima.** Su Vercel, progetto `proemios`, trova l'anteprima più recente del ramo `release/team-demo-2026-10-14` e annota l'indirizzo.
2. **Database separato.** In Settings → Environment Variables confronta `DATABASE_URL` *Preview* con `DATABASE_URL` *Production*, guardando solo host e nome del database e senza riportare la stringa.
   - Se coincidono, o se *Preview* manca: proponimi un ramo Neon dedicato a staging e procedi solo dopo il mio sì.
3. **Backup.** In Neon crea un ramo di backup del database di staging, con un nome che contenga la data. Annotalo.
4. **Migrazioni.** Sul database di staging mancano almeno la `0012`, la `0013` e la `0014`.
   - Aggiungi `RUN_MIGRATIONS_ON_PREVIEW=1` con ambito **solo Preview**.
   - Controlla che il «Build Command» non sia personalizzato: deve usare lo script `vercel-build`.
   - Dopo il redeploy cerca nei log «Migrazioni dell'anteprima aggiornate».
5. **Variabili *Preview*:**

| Variabile | Cosa metterci |
|---|---|
| `CRON_SECRET` | valore casuale lungo |
| `STRIPE_SECRET_KEY` | chiave di **test** |
| `STRIPE_WEBHOOK_SECRET` | dal webhook di test sull'anteprima, endpoint `/api/webhooks/stripe`, con gli eventi elencati in `docs/CRM_COLLAUDO.md` |
| `RESEND_API_KEY`, `EMAIL_FROM` | solo se il dominio di invio è verificato; altrimenti mostrami i record DNS |
| `BLOB_READ_WRITE_TOKEN` | dello store Blob **privato** del progetto; serve anche al caricamento diretto dei file fino a 40 MB |
| `EDITORIAL_AI_ENABLED` | lasciala a `0` finché non arriviamo alla Fase 4 |

   Lo scanner, Anthropic e Google si impostano nelle fasi successive.
6. **Redeploy e Diagnostica.** Fai il redeploy, entra come proprietario e apri Impostazioni CRM → Diagnostica.
   - Riportami lo stato di ogni voce, senza segreti.
   - Database e migrazioni devono risultare «Verificato».
   - Poi rimuovi `RUN_MIGRATIONS_ON_PREVIEW`, salvo mia indicazione diversa.

## Fase 2: scanner dei file e automazioni
1. **Scanner.** Senza scanner i clienti possono caricare solo TXT: DOCX e PDF vengono rifiutati.
   - L'app chiama `FILE_SCANNER_URL` (deve essere `https://`) con `POST`, intestazione `Authorization: Bearer <FILE_SCANNER_TOKEN>` e il file come corpo `application/octet-stream`.
   - Si aspetta in risposta JSON `{"clean": true}` oppure `{"clean": false}`.
   - Proponimi 2–3 opzioni con costo, regione dei dati (UE preferita) e conservazione dei file.
   - Se il formato del servizio scelto è diverso, dimmelo: preparo io un piccolo adattatore. **Non** impostare uno scanner finto.
   - Dopo la mia scelta imposta le due variabili (*Preview*) e prova con un DOCX innocuo e con il file di prova EICAR, se il servizio lo prevede. Il DOCX deve risultare «disponibile», il file EICAR «respinto».
2. **Pianificatore del lavoro frequente.** Serve una chiamata ogni 10–15 minuti a `/api/cron/frequent`, che comprende anche la coda AI. Proponimi le due opzioni gratuite e procedi con quella che scelgo:
   - **cron-job.org**: GET con `Authorization: Bearer <CRON_SECRET>`. Chiedimi prima di creare l'account.
   - **GitHub Actions**: una PR che copia `.github/workflows/crm-frequent-cron.yml` sul ramo predefinito (la approvo io), più i segreti del repository `CRON_URL` e `CRON_SECRET`.
3. **Verifica.** Dopo 30 minuti, Impostazioni CRM → Attività automatiche deve mostrare «Manutenzione frequente: in regola».

## Fase 3: decisioni e configurazione
1. Apri Configurazione CRM e leggimi «Decisioni aziendali ancora da prendere» con le proposte.
2. Poi chiedimi i valori, uno per gruppo:
   - flussi, marchio ed email di assistenza;
   - catalogo dei pacchetti;
   - orari e tempi di risposta;
   - attribuzione e percentuali provvigionali;
   - regime IVA e condizioni di pagamento (dal commercialista);
   - regola d'acquisto.
3. In Impostazioni CRM → **AI, costi e revisioni** chiedimi:
   - modello, impegno, tetto per lavorazione e tetto mensile;
   - se le revisioni incluse possono avviare l'AI da sole;
   - se attivare l'assistente commerciale;
   - il cambio USD→EUR;
   - i cicli di revisione inclusi per ciascun servizio.
4. In Impostazioni CRM → **Home venditori** chiedimi se tenere le soglie proposte.
5. Ogni valore va inserito con «Vedi cosa cambia» → controllo → «Approva e salva». Alla fine mostrami lo stato della Configurazione CRM.

## Fase 4: AI e Google su staging
1. **Anthropic.** Solo dopo la mia conferma su termini e trattamento dei dati:
   - nella Console crea una chiave dedicata a staging, con il limite di spesa che ti indico;
   - imposta `ANTHROPIC_API_KEY` ed `EDITORIAL_AI_ENABLED=1` (*Preview*);
   - fai il redeploy.
2. **Google Docs (facoltativo, solo se lo voglio).**
   - Crea un client OAuth «Web» nel progetto Google Cloud che ti indico.
   - Abilita le API Docs e Drive.
   - URI di ritorno: `https://<anteprima>/api/integrations/google/callback`.
   - Imposta `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` (*Preview*).
   - Collega un account Google di prova da Impostazioni CRM → Diagnostica.

## Fase 5: collaudo completo su staging
Account di prova con caselle che controllo io:
- proprietario, due venditori, un responsabile di produzione, un editor e due clienti;
- inviti da Persone e accessi con il modello di ruolo giusto;
- credenziali e URI `otpauth` solo in un file locale, mai nel repository né in chat.

Segui `docs/CRM_COLLAUDO.md`, scenari A–F. Se hai un terminale usa `node scripts/collaudo-crm.mjs avvia` e poi `node scripts/collaudo-crm.mjs dopo-pagamento`.

Segui poi `docs/PROEMIOS_COLLAUDO.md` («Da ripetere su staging»):
1. Acquisto di prova con la carta di test.
2. Caricamento di un DOCX sintetico, e di un PDF tra 5 e 40 MB per il caricamento diretto.
3. Importazione nello Studio e correzione di bozze AI.
4. Controllo di proposte, costo nella Cabina di regia e avviso all'editor con il link.
5. Accettazione delle proposte ed esportazione del DOCX con revisioni. **Apri il DOCX in Microsoft Word** (o in Google Docs) e verifica che le revisioni si accettino e rifiutino correttamente.
6. Consegna della V1.
7. Come cliente: osservazione e richiesta di revisione. Come responsabile: decisione, nuova lavorazione, controllo qualità e consegna della V2.
8. Assistente commerciale, se attivato, su una trattativa di prova: deve restituire solo una bozza.

Per ogni scenario scrivi «verificato» o «non verificato» con il motivo, più screenshot senza dati personali.

## Fase 6: testi legali e persone
1. Preparami in bozza, senza pubblicarli:
   - l'aggiornamento della privacy: Anthropic (e Google, se usato) come fornitori che trattano i testi; scanner; conservazione dei manoscritti;
   - le condizioni contrattuali sui cicli di revisione e sugli extra;
   - la pagina cookie, se attiviamo GA4.
   Indicami cosa deve rivedere un legale.
2. Quando ti do l'elenco delle persone reali, invitale nell'ambiente che ti indico con il modello di ruolo giusto. Competenze, lingue, capacità e limiti di sconto me li fai confermare persona per persona.

## Fase 7: produzione (ogni passo solo con il mio sì)
Preparami prima la lista completa e aspetta l'approvazione passo per passo:
1. **Backup.** Ramo Neon di backup del database di produzione, e prova che si legga.
2. **Migrazioni.** In produzione, una volta e a mano (`npm run db:migrate` con il `DATABASE_URL` di produzione, da un terminale sicuro). `RUN_MIGRATIONS_ON_PREVIEW` in produzione blocca la build: non va impostata.
3. **Variabili *Production*:**
   - Stripe live, con webhook live su `https://<dominio>/api/webhooks/stripe`;
   - Resend, Blob, scanner, `CRON_SECRET`, Fatture in Cloud (`FIC_*`) se la fatturazione automatica è decisa;
   - `PROEMIOS_OWNER_EMAIL` (solo se manca);
   - Anthropic con chiave e limite di produzione, ma `EDITORIAL_AI_ENABLED=0` finché le regole non sono approvate in produzione.
4. **Pianificatore** puntato al dominio di produzione.
5. **Unione del codice.** Unisci la PR di lancio (release → ramo predefinito), già preparata in bozza, **solo con il mio sì**. Prima consiglio la protezione del ramo predefinito: PR obbligatoria e controllo `verify` verde.
6. **Controlli dopo la pubblicazione:**
   - Diagnostica in produzione;
   - un acquisto reale di importo minimo, solo se lo decido io;
   - una lavorazione AI su un testo interno;
   - costo visibile nella Cabina di regia.
7. **Indicizzazione.** `PROEMIOS_PRODUCTION_READY=1` rende il sito indicizzabile dai motori di ricerca: solo a checklist completata e con il mio sì.
8. **Ritorno indietro.** Tieni pronti i passi di `docs/PROEMIOS_GO_LIVE.md` §3 (pausa AI, deployment precedente, ripristino dal ramo Neon).

## Formato dei tuoi aggiornamenti
Alla fine di ogni fase mandami una tabella con quattro colonne: «Operativo e verificato», «Configurato ma non verificato», «Da collegare», «Da decidere». Per ogni riga indica dove l'hai visto: Diagnostica, log di build, Stripe, Neon o altro. Alla fine elenca i difetti trovati, con i passi per riprodurli.
