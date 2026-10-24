# Proemios — preparazione al lancio del 26 ottobre 2026

Verifica eseguita il 24 ottobre 2026. **Esito: lancio operativo bloccato.**
Il codice del candidato contiene il CRM e Document Studio; la versione pubblica serve ancora la demo precedente. Una build READY non dimostra che account e servizi siano operativi.

## Evidenze attuali

| Controllo | Risultato osservato |
|---|---|
| Repository | `ponyexpress83/Proemios` |
| Produzione `proemios.vercel.app` | commit `16fe6960d8871b10141f251cfc9c55a2305b43a5`, ramo `claude/kalamos-studio-phase-1-6z6xyw` |
| Contenuto della home di produzione | banner DEMO, nessun pagamento o email reale, meta `noindex, nofollow` |
| Ultima anteprima elencata da Vercel | `https://proemios-oln2ls3uj-valerio-gestri-s-projects.vercel.app`, commit `15e1101a71171952d552c166a4693ac656cc2ea0`, READY |
| Ultima anteprima: `GET /api/auth/get-session` | HTTP 503, `SERVICE_UNAVAILABLE` |
| Ultima anteprima: `GET /api/platform/projects` | HTTP 503, `SERVICE_UNAVAILABLE` |
| Ultima anteprima: `GET /robots.txt` | HTTP 200, `Disallow: /` |
| Variabili Vercel | 8 record, tutti Preview e legati a rami specifici; nessun record Production e `hiddenProductionEnvCount=0` |
| Rami con configurazione parziale | `release/team-demo-2026-10-14`: DATABASE_URL, BETTER_AUTH_SECRET, PROEMIOS_OWNER_EMAIL; `feat/real-role-access-staging-20261014`: gli stessi più APP_URL; `codex/proemios-production-20261008`: solo PROEMIOS_OWNER_EMAIL |
| Ramo dell'ultima anteprima | `claude/proemios-complete-v1-w78xtx`, senza variabili proprie o Preview generali elencate |
| Dominio collegato al progetto | solo `proemios.vercel.app`; `proemios.it` non compare fra i domini collegati |
| Protezione Vercel | SSO `all_except_custom_domains` |
| Neon | ricerca Proemios senza risultati; progetto di staging documentato `green-river-20539550` non accessibile dalla connessione corrente (404/UNAVAILABLE) |
| Release | PR #27 aperta verso release; PR #28 di lancio aperta in bozza. Il candidato dell'ultima anteprima è 4 commit avanti alla release e 90 avanti alla produzione |

La prova HTTP usa l'accesso temporaneo autorizzato di Vercel: non dimostra l'accessibilità del sito a un visitatore anonimo. Non sono stati riportati segreti né dati personali.

## Blocchi e azioni necessarie, nell'ordine

| Priorità | Mancanza o incertezza | Azione e criterio di chiusura |
|---|---|---|
| 1 | Accesso al progetto Neon di staging non disponibile | Ripristinare l'accesso al progetto esistente. Leggere schema e registro; creare e verificare un ramo di backup prima di migrare. Non sostituire il database con uno nuovo per aggirare il problema |
| 2 | Candidato più recente privo dei servizi necessari | Scegliere il candidato da collaudare, impostare Preview su quel ramo con DATABASE_URL separato, BETTER_AUTH_SECRET e APP_URL coerente. Verificare l'identità owner già autorizzata. Applicare con Drizzle le migrazioni mancanti fino a 0014 dopo il backup; mai db:push |
| 3 | Email non configurate in Vercel | Collegare RESEND_API_KEY, EMAIL_FROM e EMAIL_INTERNAL, dominio mittente verificato. Provare registrazione, verifica email, recupero accesso e inviti su caselle controllate, senza invii a collaboratori non richiesti |
| 4 | Stripe non configurato in Vercel | Su staging chiave e webhook TEST. Provare firma, duplicati, pagamento fallito e riuscito, un solo progetto dopo l'acconto verificato, rimborso/storno. Production richiede chiave e webhook LIVE separati |
| 5 | Archivio e scanner non configurati in Vercel | Collegare Blob privato e FILE_SCANNER_URL/TOKEN. Provare DOCX e PDF innocui, accessi negati fra clienti, dimensioni e caricamento diretto. Senza scanner il codice ammette solo TXT |
| 6 | Automazioni non dimostrate operative | Impostare CRON_SECRET e pianificare giornaliero e frequente ogni 10–15 minuti. Verificare registrazioni riuscite, errori e ripetizione senza effetti duplicati. La sola presenza del workflow non prova che sia attivo |
| 7 | Configurazione aziendale del DB non verificabile | Leggere le regole già approvate prima di chiedere nuovi valori. Completare solo ciò che manca: ruoli/deleghe, assegnazioni/orari, catalogo, provvigioni, IVA e condizioni d'acquisto. Non copiare valori dei test |
| 8 | Account e flussi reali non collaudati sul candidato | Provare autore, super admin, admin delegato, venditore, marketing, produzione/operatore e affiliato: MFA staff, isolamento dei dati, revoca sessioni, preventivo → contratto → acconto → progetto → lavorazione → consegna → revisione cliente |
| 9 | AI editoriale non configurata in Vercel | Per il lancio con AI: provider, chiave, limiti di spesa, regole/cicli e trattamento dati approvati. Una chiamata su testo sintetico deve registrare costi e produrre proposte soggette a controllo umano; aprire il DOCX con revisioni in Word. Abilitare solo dopo queste prove |
| 10 | Fatturazione automatica non configurata in Vercel | Collegare Fatture in Cloud e verificare azienda, aliquote e conto d'incasso. Evitare fatture fiscali reali nei test; definire la gestione operativa delle fatture prima di incassare |
| 11 | Testi e processi legali non validati da questa verifica | Verificare termini, privacy, fornitori AI/scanner, conservazione e cicli di revisione rispetto ai servizi effettivamente attivati. La presenza dei testi nel repository non prova l'approvazione |
| 12 | Produzione priva di configurazione e dominio del marchio | Dopo il collaudo: DB Production distinto e backup provato, migrazioni manuali, configurazione Production, rilascio della PR #28 con il candidato finale, collegamento e HTTPS di proemios.it e accesso anonimo. Controllare i record DNS esistenti prima di modificarli |
| 13 | Indicizzazione disabilitata | Solo dopo esito positivo sul dominio definitivo, impostare PROEMIOS_PRODUCTION_READY=1, verificare robots, sitemap, canonical e rimozione del banner demo |

Google Docs, Brevo, GA4 e API esterne sono facoltativi: possono restare disattivati se non fanno parte del servizio offerto al lancio. Non sono necessari per lavorare nell'editor interno.

## Correzione preparata durante questa verifica

`migrationStatus` prima controllava, in assenza del registro Drizzle, soltanto le tabelle CRM e cron. Poteva quindi dare un falso esito positivo a un database privo della migrazione 0014. Ora controlla tutte le 11 tabelle di Document Studio e segnala `0014_document_studio` se anche una manca. Sono aggiunti 14 test di regressione per registro, schema parziale, schema completo ed errore di connessione.

Questa correzione non applica migrazioni e non configura i servizi. Nessun rilascio di produzione, modifica DNS, invito reale, addebito o fattura è stato eseguito.

## Verifica del codice

TypeScript e lint superati. La suite completa passa con 228/228 test (16 file) usando un worker e un timeout di 15 secondi per test. Con il timeout predefinito di 5 secondi, i test CRM delle attività automatiche sono andati in timeout: questo limite di collaudo è registrato, non nascosto aumentando la soglia nel repository. La build iniziale del candidato è riuscita; le due build locali successive alla correzione hanno compilato e generato 74 pagine, ma si sono interrotte nella pulizia export con ENOTEMPTY.

**Verifica successiva su Vercel:** la build del codice corretto, commit `e45955dd562c7f5a118bdfa976398250c8629b4a`, è **READY**, deployment `dpl_GaA6dUNq1nwpuL4wJoddsPiiTQST`, anteprima `https://proemios-amdjviwyj-valerio-gestri-s-projects.vercel.app`. Il commit successivo `1e1794462dc43272156a283d1b898670006e21a8` modifica soltanto questo rapporto. La build del codice è quindi verificata su Vercel; restano tutti i blocchi operativi elencati sopra.

I test locali usano database isolati e servizi simulati: non certificano Stripe, email, scanner, storage o AI reali.
