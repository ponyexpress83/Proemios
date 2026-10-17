# CRM: messa in uso — rapporto del 17 ottobre 2026

Seguito di `docs/CONSEGNA_CRM_2026-10-17.md` (PR #23, unita in `release/team-demo-2026-10-14`). Questo lavoro non ricostruisce il CRM e non aggiunge grandi blocchi: rende configurabile dall'interfaccia ciò che c'era, aggiunge la configurazione guidata, il simulatore, la pianificazione separata delle attività automatiche e la diagnostica, e corregge i difetti trovati durante la verifica.

Restano fuori ambito: multi-azienda completo, vendita di licenze, altre espansioni.

## 1. Stato reale verificato

Verifica fatta il 17/10/2026 dalle deployment di GitHub (integrazione Vercel), senza accesso a Vercel o al database.

| Cosa | Stato verificato | Fonte |
|---|---|---|
| Merge della PR #23 | commit `83d9edb` su `release/team-demo-2026-10-14` | git |
| Merge della PR #24 (questo lavoro) | commit `62f9b2a` su `release/team-demo-2026-10-14`, anteprima di Vercel generata dal ramo | git, API deployment di GitHub |
| Deployment che contiene il merge | **solo Preview**: https://proemios-bljemb8s4-valerio-gestri-s-projects.vercel.app (stato «success», commit `83d9edb`) | API deployment di GitHub |
| Produzione | ultima deployment di produzione: commit `16fe6960` del 6/10/2026, **senza il CRM** | API deployment di GitHub |
| Database della Preview | **non verificabile da qui**: nessun accesso a Vercel o al database. Dopo l'accesso, lo mostra **Impostazioni CRM → Diagnostica → Database e migrazioni** | — |
| Migrazioni | servono `0012_crm_relations` (CRM) e `0013_automation_runs` (registro delle attività automatiche) sul database usato dalla Preview: `npm run db:migrate` con il `DATABASE_URL` di quell'ambiente, oppure `RUN_MIGRATIONS_ON_PREVIEW=1` con ambito *Preview* (lo script `vercel-build` migra solo in anteprima e solo se il database è separato da quello di produzione; in produzione si rifiuta). Vedi `docs/CRM_COLLAUDO.md` | `package.json`, `scripts/vercel-build.mjs`, `drizzle/` |
| Raggiungibilità della Preview da questo ambiente | **bloccata**: la politica di rete dell'ambiente di lavoro rifiuta `*.vercel.app` (CONNECT 403) | prova con curl |
| Ramo predefinito del repository | `claude/kalamos-studio-phase-1-6z6xyw` (rilevante per il workflow GitHub Actions, §5) | API GitHub |

Non si deduce che la versione pubblicata sia aggiornata dal solo merge: la Preview contiene il codice di `83d9edb`; se il suo database abbia le migrazioni non è stato possibile verificarlo.

## 2. Cosa è stato aggiunto

### Configurazione guidata («Configurazione CRM»)
Nuova scheda per chi ha `settings.manage`, `role.manage` o `crm.assign`. Barra di avanzamento e 8 sezioni: Marchio e azienda · Catalogo · Team e permessi · Orari e assegnazioni · Attribuzione e regole commerciali · Email · Pianificazione delle attività automatiche · Verifica finale. Ogni sezione è **configurata**, **da completare**, **non necessaria** o **errore da risolvere**.
- Prima si scelgono i flussi davvero usati (richieste dal sito, vendite assistite, link a pacchetto, produzione, API esterne); una sezione che il flusso non richiede è «non necessaria».
- I valori predefiniti sono proposte: finché non sono approvati la sezione resta «da completare» e il CRM **non** risulta pronto.
- In fondo, l'elenco delle **decisioni aziendali ancora aperte**, ciascuna con una proposta da verificare e il link a dove si decide. Competenze, turni, lingue, percentuali, limiti di sconto e disponibilità delle persone non vengono proposti né dedotti.

### Impostazioni CRM (sostituisce «Regole CRM»)
Sezioni: Marchio · Catalogo · Pipeline · Campi personalizzati · Motivi di perdita · Modelli e checklist · Attribuzione · Assegnazione e scadenze · Prova assegnazione · Attività automatiche · Diagnostica · API e webhook · Storico. Moduli normali, nessun editor JSON.
- **Anteprima obbligatoria**: ogni regola versionata mostra «cosa cambia» (campo per campo) e l'effetto («vale da ora in avanti…») prima di «Approva e salva». Un salvataggio senza modifiche è rifiutato (409).
- **Storico**: ogni approvazione crea una versione con autore e data; la storia mostra le differenze tra versioni.
- **Archiviare invece di eliminare**: il server rifiuta di togliere fasi usate da trattative, la pipeline «Vendite», motivi usati da trattative chiuse, pacchetti già inviati con un link e opzioni di campi già compilate. Si archiviano; i record restano leggibili.
- **Nessun effetto retroattivo**: proposte, contratti, attribuzioni e provvigioni già registrati non cambiano; le scadenze già calcolate restano; le trattative in corso non vengono riassegnate.
- **Catalogo coerente con l'acquisto**: un pacchetto è accettato solo se è un servizio singolo a prezzo di listino **e** compare tra i servizi acquistabili senza valutazione della regola d'acquisto in vigore. I prezzi vengono dal listino (`computeQuote`), non si scrivono a mano. Non sono stati aggiunti piani o prezzi.
- **Modelli**: ogni modifica conserva la versione precedente; un modello archiviato resta nello storico.
- **Permessi distinti**: le regole economiche richiedono `settings.manage`, chiavi API e webhook `integrations.manage`. Marketing e «Admin con Marketing» non hanno né l'uno né l'altro (verificato con test: 403). Chi ha solo lettura vede le impostazioni senza pulsanti di modifica.

### Team
- Inviti con stato **in attesa / scaduto / accettato / revocato**, esito dell'invio email ed eventuale errore breve, revoca.
- Un secondo invito in attesa per la stessa email e lo stesso ruolo, o per un ruolo già attivo, è rifiutato (409).
- Per ogni persona: **profilo incompleto** (cosa manca), **partecipazione all'assegnazione** con il motivo se esclusa, **carico/capacità**.

### Prova assegnazione (simulatore)
Origine, servizio, lingua, priorità, data/ora simulata (e facoltativamente l'email di un cliente per vedere se ha una trattativa aperta). Mostra persone considerate ed escluse con il motivo, responsabile proposto, scadenza di prima risposta, comportamento quando nessuno è disponibile, versione della regola. Usa lo stesso motore dell'assegnazione reale (`chooseAssignee`, orari, capacità) e **non scrive nulla** (verificato contando richieste, notifiche, attività, assegnazioni e audit prima e dopo).
In **Assegnazione e scadenze** la stessa prova gira con la regola in bozza e mostra le conseguenze: quante richieste in coda verranno riprovate, quante scadenze restano invariate, quante trattative aperte **non** vengono riassegnate.

### Attività automatiche
- Due lavori separati: **manutenzione frequente** (`/api/cron/frequent`, ogni 10–15 minuti) e **attività giornaliere** (`/api/cron`, una volta al giorno). Dettaglio in `docs/CRM_OPERATIVO.md` §7.
- Autenticazione con `CRON_SECRET` (confronto a tempo costante), blocco contro le sovrapposizioni, registro di ogni esecuzione, errori per passo senza fermare gli altri, limiti per giro (20 webhook, 20 email).
- Il lavoro giornaliero chiamato più volte nello stesso giorno viene **saltato**: niente riepiloghi, notifiche o provvigioni doppie. Webhook e provvigioni sono comunque protetti da chiavi uniche.
- Vista per l'amministratore: ultimo tentativo, ultima riuscita, ritardo rispetto alla frequenza attesa, ultimo errore, lavori in attesa (email, webhook, richieste in coda, prenotazioni scadute, prime risposte in ritardo, fatture).

### Diagnostica delle integrazioni
Database e migrazioni, email e mittente, pagamenti (modalità prova/reale dedotta dal prefisso della chiave, senza mostrarla) e webhook Stripe, cron frequente e giornaliero, webhook in uscita, API, Fatture in Cloud, Brevo, archivio file, indirizzo dell'app. Stati: **verificata** (un fatto recente lo dimostra), **configurata**, **non configurata**, **errore**. Nessun segreto mostrato, nessuna chiave creata, nessun test invasivo.

## 3. Difetti trovati e corretti durante la verifica

| Difetto | Effetto prima | Correzione |
|---|---|---|
| Link a pacchetto usato da un cliente già seguito da un altro venditore | la vendita veniva accreditata **in via definitiva** a chi aveva creato il link, togliendo il cliente al collega | il link non sposta più un cliente seguito: la vendita diventa un **conflitto** da decidere (`link_other_owner`), provvigione del venditore sospesa. Un cliente **nuovo** che arriva dal link va invece a chi l'ha portato, se attivo |
| Chiave `amazonListing` del catalogo predefinito | il catalogo proposto non si poteva approvare così com'era (422) | la chiave è ammessa; i link già creati restano validi |
| Inviti doppi | si potevano mandare più inviti uguali in attesa | 409 con messaggio chiaro |
| Pipeline archiviata | si potevano ancora aprire trattative | 409 `PIPELINE_ARCHIVED` |

## 4. Verifiche: locali e su deployment, separate

### In locale (eseguite)
- `tsc --noEmit`, `eslint .`: puliti. `npm run build`: riuscita.
- Test automatici: **190 superati su 190** (13 file). In una delle prime esecuzioni complete 5 test del file CRM sono falliti senza che l'errore venisse salvato; nelle 13 esecuzioni complete successive (con i log salvati) tutti i test sono passati. Nuovi test della messa in uso nel blocco «putting the CRM into use» di `tests/crm.integration.test.ts` e in `tests/crm-core.test.ts`. Database PGlite con le migrazioni reali, autenticazione reale (Better Auth + TOTP), posta in cartella locale, Stripe simulato con eventi firmati a mano.
- Browser (Chromium) su server locale con Postgres locale e utenti di prova `@example.test`, desktop 1280 px e telefono (iPhone 13): configurazione guidata, anteprima e approvazione del marchio, tutte le sezioni delle impostazioni, simulatore, invito di un venditore di prova; nessuno scorrimento orizzontale, nessun errore in console; un venditore vede le impostazioni in sola lettura e non vede la configurazione guidata.

Inviti verificati end-to-end per i 7 modelli (venditore, Marketing, Admin con Marketing, Admin gestione team, operatore, collaboratore esterno, responsabile di produzione), ciascuno con destinatario di prova: invito → email nella cartella di prova → registrazione → accesso rifiutato finché l'email non è verificata → link di verifica → un altro account non può usare l'invito → accettazione → sessioni chiuse → nuovo accesso → 428 «attiva la verifica in due passaggi» → TOTP → permessi controllati sugli endpoint del server.

### Scenari A–F

| Scenario | In locale (test automatici) | Sulla Preview pubblicata |
|---|---|---|
| A. Lead da campagna → assegnazione → notifica → attività del venditore | ✅ «routes an Ads request…», «shows each person a single work board…» | non eseguito |
| B. Proposta personalizzata → accettazione → pagamento di prova → attribuzione → un solo progetto → passaggio | ✅ «custom quote: authorized lines…» (eventi Stripe duplicati: un progetto, un passaggio, una provvigione) | non eseguito |
| C. Link a pacchetto → acquisto di prova → attribuzione | ✅ «a followed client buys a standard package…», «a package link cannot be used to take over…» | non eseguito |
| D. Nessun venditore idoneo → coda monitorata → assegnazione successiva | ✅ «queues requests when nobody is eligible…» | non eseguito |
| E. Operatore → solo materiali autorizzati → avanzamento visibile al cliente | ✅ «suggests and assigns operators…», «hands off with missing materials…» | non eseguito |
| F. Cron ripetuto e webhook duplicati → nessun effetto doppio | ✅ «runs frequent and daily jobs with a lock…», «delivers signed webhooks…», eventi Stripe ripetuti in B | non eseguito |

Il collaudo sull'anteprima si esegue con `scripts/collaudo-crm.mjs` o dall'interfaccia, seguendo `docs/CRM_COLLAUDO.md`; il prompt per completare configurazione e collaudo con Claude Cowork è in `docs/PROMPT_COWORK_CRM.md`. Lo script ha superato tutti i passi contro un server locale.

**Perché la Preview non è stata collaudata**, con precisione:
1. L'ambiente di lavoro non raggiunge `*.vercel.app` (proxy: CONNECT 403). Per consentirlo va aggiunto il dominio della Preview (o `*.vercel.app`) tra i domini consentiti nella configurazione di rete dell'ambiente.
2. Servono utenti di prova sulla Preview (almeno proprietario e due venditori con verifica in due passaggi) o il permesso di crearli con destinatari di prova.
3. Se la Preview è protetta (Vercel Deployment Protection) serve un bypass per l'automazione.
4. Le migrazioni `0012` e `0013` devono essere applicate al database della Preview; dalla Diagnostica si vede se mancano.
5. Il pagamento di prova richiede chiavi Stripe **di test** e il segreto del webhook su quell'ambiente.

## 5. Come configurare e usare il CRM

1. Applica le migrazioni sul database dell'ambiente: `npm run db:migrate`.
2. Accedi come proprietario e apri **Configurazione CRM**: scegli i flussi, poi segui le sezioni da completare. Ogni «Apri →» porta alla schermata giusta.
3. **Impostazioni CRM → Marchio**, **Catalogo**, **Attribuzione**, **Assegnazione e scadenze**: controlla i valori proposti, «Vedi cosa cambia», «Approva e salva».
4. **Team e carichi**: invita le persone con il modello di ruolo (solo da un elenco autorizzato); completa lingue, competenze e capacità di ciascuno. Il profilo incompleto è segnalato.
5. **Prova assegnazione**: prova origini, lingue, orari; controlla chi viene escluso e perché.
6. **Attività automatiche**: imposta `CRON_SECRET` sull'ambiente e scegli un pianificatore per `/api/cron/frequent` (§6).
7. **Diagnostica**: tutto ciò che serve ai flussi scelti deve risultare «verificata» o almeno «configurata»; la **Verifica finale** della configurazione guidata dice cosa manca.
8. Collaudo con destinatari di prova (scenari A–F) prima di invitare persone reali.

## 6. Configurazioni mancanti

| Cosa | Dove | Note |
|---|---|---|
| Migrazioni 0012 e 0013 sul database della Preview | `npm run db:migrate` | non verificabile da qui |
| `CRON_SECRET` sull'ambiente | variabili d'ambiente Vercel | senza, entrambi i cron rispondono «non disponibile» |
| Pianificatore per `/api/cron/frequent` | GitHub Actions o cron-job.org | il workflow `.github/workflows/crm-frequent-cron.yml` è **predisposto, non attivo**: GitHub esegue le pianificazioni solo dal ramo predefinito (oggi `claude/kalamos-studio-phase-1-6z6xyw`) e servono i segreti `CRON_URL`, `CRON_SECRET` del repository |
| Servizio email reale e mittente verificato | Resend e dominio | finché è il trasporto di prova, inviti e notifiche non raggiungono nessuno |
| Segreto del webhook Stripe dell'ambiente | Stripe Dashboard + `STRIPE_WEBHOOK_SECRET` | la diagnostica lo segnala come errore se manca |
| Dati di ogni persona | Team e carichi | competenze, lingue, capacità, sconto massimo: da indicare, non dedotti |

## 7. Costi da approvare

Nessun servizio a pagamento è stato attivato.

| Opzione per la manutenzione frequente | Costo | Limiti |
|---|---|---|
| GitHub Actions (repository pubblico) | gratuito | minimo ogni 5 minuti, puntualità non garantita, solo dal ramo predefinito |
| cron-job.org | gratuito | servizio esterno; conserva l'indirizzo e l'intestazione con il segreto |
| Vercel Pro | a pagamento (prezzo per utente al mese secondo il listino Vercel in vigore, da verificare sulla pagina prezzi) | cron fino a ogni minuto |

Il piano Hobby di Vercel esegue i cron al massimo una volta al giorno (documentazione Vercel sui limiti dei cron). Il sito `vercel.com` non era raggiungibile da questo ambiente: limiti e prezzi vanno riconfermati sulla documentazione ufficiale prima di decidere.

## 8. Decisioni aziendali da confermare

Le stesse compaiono, aggiornate, nella configurazione guidata.

1. Quali flussi userete davvero (proposta: tutti tranne le API esterne).
2. Nome del marchio ed email di assistenza nei modelli (l'email generale è ancora un TODO nel codice).
3. Pacchetti standard venduti con un link (proposta: copertina, ePub, KDP, ISBN, scheda Amazon, ai prezzi del listino in vigore).
4. Giorni e orari di servizio, festività, tempi di prima risposta per priorità, escalation, modalità per origine (proposta: lun–ven 9–18 Europe/Rome; 60/120/480/1440 minuti; escalation dopo 120).
5. Competenze, lingue, capacità e sconto massimo di ogni persona.
6. Finestra di relazione e cumulo venditore/affiliato (proposta: 90 giorni, entrambi).
7. Percentuali provvigionali e vendite assistite: **nessuna proposta**, da decidere.
8. Regime IVA e condizioni di pagamento: da confermare con il commercialista.
9. Regola d'acquisto: servizi acquistabili da soli, sconti massimi, rate.
10. Quale pianificatore usare per la manutenzione frequente (§7).

## 9. Riepilogo

| Operativo e verificato | Configurabile dall'interfaccia | Da collegare | Da decidere |
|---|---|---|---|
| In locale, con test automatici e browser: configurazione guidata e stato «non pronto» con i valori proposti; anteprima, approvazione, storico e archiviazione delle regole; blocchi su ciò che i record usano; inviti end-to-end per i 7 modelli con email verificata e due passaggi; stati degli inviti ed errori di invio; simulatore senza scritture; lavori frequente/giornaliero con blocco, registro e nessun effetto doppio; protezione dei cron con il segreto; diagnostica senza segreti; link a pacchetto che non sottrae clienti; permessi economici e integrazioni separati da Marketing | Marchio, catalogo (entro la regola d'acquisto e il listino), pipeline aggiuntive, campi, motivi di perdita, modelli e checklist, attribuzione e cumulo, orari, scadenze, modalità per origine, coda libera, capacità, profili delle persone, flussi usati, chiavi API e webhook | Migrazioni sul database della Preview; `CRON_SECRET`; pianificatore per `/api/cron/frequent`; email reale e mittente verificato; segreto del webhook Stripe dell'ambiente; accesso di rete e utenti di prova per collaudare A–F sulla Preview; produzione ancora a `16fe6960` | Le 10 decisioni del §8, tra cui percentuali provvigionali, regime IVA, orari reali, pacchetti in vendita e l'eventuale spesa per Vercel Pro |

Nessuna funzione è dichiarata attiva sulla Preview: lì nulla è stato verificato. Il prodotto resta per una sola azienda per installazione.
