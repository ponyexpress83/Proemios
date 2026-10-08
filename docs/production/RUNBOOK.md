# Gestione e ripristino

## Avvio staging

1. Collegare servizi test separati e variabili nominate in `.env.example` tramite configurazione protetta; nessun segreto nel repo. APP_URL/BETTER_AUTH_URL sono l’origine applicativa autorizzata; NEXT_PUBLIC_SITE_URL resta https://proemios.it.
2. Verificare backup DB e storage sul piano reale e provare restore in ambiente isolato prima di toccare dati live. Il test PGlite dump/restore non certifica PITR del servizio.
3. Eseguire `npm ci`, `npm run db:migrate` verso il DB staging; migrazioni 0002–0005 additive dopo 0000–0001. Non usare db:push/reset/seed su produzione. Il seed è bloccato fuori dai test isolati.
4. Prima di abilitare DOCX/PDF, verificare scanner e parser anche con archivi compressi anomali, limiti di espansione/estrazione e file corrotti nello staging. Il solo magic byte non certifica sicurezza del documento.
5. Registrare/verificare l’owner autorizzato, configurare TOTP, chiudere bootstrap rimuovendo PROEMIOS_OWNER_EMAIL e controllare il flag DB owner-bootstrap. Invitare soltanto identità e destinatari esplicitamente autorizzati.
6. Configurare policy economiche approvate/versionate. Controllare nome mittente, Webhook Stripe test e accesso private Blob. Flags analisi e release restano spenti fino alle prove.
7. Eseguire test provider positivo/errore/retry e percorsi autore/editor/seller/affiliate/finance; annotare ID sintetici senza token.

## Incidenti

| Evento | Azione sicura | Evidenza di recupero |
|---|---|---|
| Email fallita | Controllare vista Operazioni, mittente e stato provider; retry autorizzato MFA dopo errore, max5 automatici | Richiesta esiste ancora; accepted significa accettata dal provider, non consegnata |
| Invito scaduto/revocato | Verificare email e delega; revocare e creare nuovo invito autorizzato | Vecchio token non funziona; sessione dopo accettazione rinnovata |
| Utente bloccato | Recupero password supportato; MFA con codice recovery offline; controllo identità per intervento owner | Nessun bypass condiviso; sospensione/revoca effettiva al prossimo accesso |
| Upload sospetto | Lasciare quarantena, mai download; scanner rifiuta e rimuove oggetto | Formato vietato/4MB rifiutati; TXT UTF-8 alternativa |
| Analisi fallita | ANALYSIS_ENABLED=0 ferma nuove chiamate; consultare codice errore | Nessun report inventato; retry manuale max3 con conferma costo e manutenzione |
| Job interrotto | Lease scaduta => failed con review richiesta; controllare costo provider prima di riprovare | Polling legge DB soltanto; nessuna doppia chiamata per refresh |
| Stripe mancante/fuori ordine | Controllare dashboard provider, firma, test/live, importo e risorsa; riconciliazione permessa recupera checkout | ID/event/intent unici; errore rimborsi precedenti al pagamento risponde per retry |
| Rimborso/liquidazione | Solo preparazione/registrazione autorizzata; verificare evidenza provider e processo approvato | Nessun bonifico o refund API automatico disponibile |
| Cron/cleanup | Bearer CRON_SECRET; esecuzione manuale autorizzata o cron giornaliero; guardare deleted/scanned/errori | Oggetto e report cancellati nei test; scheduler live da verificare |
| Rilascio difettoso | Fermare flags costosi, rollback applicativo all’ultima versione verificata senza cancellare dati | Migrazioni additive restano; ricontrollare auth/cache/callback/provider |

La manutenzione configurata in vercel.json è giornaliera: non si promette consegna entro minuti per un retry. Le analisi nuove partono con Next after; quelle riprovate tramite manutenzione. Attivare cron più frequente soltanto dopo verifica piano/costi e cadenza approvata.

Le vecchie preview/demo non sono rollback adatto per un lancio con utenti live perché non rispettano i nuovi accessi. Prima del primo lancio creare una versione verificata compatibile con schema auth, backup e flags spenti come riferimento di rollback. Non fare migrazioni inverse distruttive.

Cifratura outbox dipende da BETTER_AUTH_SECRET: non ruotarlo senza piano per decifrare i messaggi pendenti e migrazione delle sessioni/TOTP. Non stampare HTML/token nei log. Gli alert automatici richiedono destinatario e sistema configurati; la vista Operazioni da sola non è un allarme.
