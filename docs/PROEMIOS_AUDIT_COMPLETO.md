# Proemios 2.0: audit completo

Data: 18/10/2026. Ogni riga dice **come** è stata verificata.

Livelli usati in tutti i documenti `PROEMIOS_*`:
- **Implementato nel codice**: esiste ed è unito nel ramo indicato.
- **Verificato nei test locali**: test automatici, PGlite o Postgres locale, provider simulati.
- **Verificato su staging**: provato sull'anteprima Vercel con credenziali di prova.
- **Operativo in produzione**: attivo sul dominio pubblico con servizi reali.

Non sono equivalenti. Ad oggi nessuna funzione del CRM e di Proemios 2.0 è verificata su staging o operativa in produzione.

## 1. GitHub

Verificato tramite l'API di GitHub.

| Voce | Stato |
|---|---|
| Ramo predefinito | `claude/kalamos-studio-phase-1-6z6xyw` (invariato rispetto al controllo precedente) |
| Ramo di lavoro aggiornato | `release/team-demo-2026-10-14`, testa `6e9e1af` (merge della PR #25) |
| Relazione tra i due | la release è **78 commit avanti e 0 indietro** rispetto al ramo predefinito, su 289 file: nessun conflitto, solo commit in più |
| Produzione | ultima deployment *Production* = `16fe696` (6/10/2026), cioè la testa del ramo predefinito; il CRM non è in produzione |
| Anteprime | ogni commit della release genera una *Preview*; l'ultima è `6e9e1af` |
| Protezione dei rami | nessun ramo protetto e nessun ruleset |
| PR aperte | #18, #17, #16, #15, #14, #12, #5, #4. Sono in gran parte bozze superate dal lavoro unito nella release. La #4 («AI back-office editoriale») contiene principi che questo lavoro riprende: confine cliente/back-office, controllo umano obbligatorio, originale immutabile, revisioni Word reali |
| GitHub Actions | `ci.yml` attivo (typecheck, test, lint, build con Node 24) su PR e sui push al ramo predefinito e ad `ads-ready-sep-2026`; `crm-frequent-cron.yml` presente solo nella release, quindi **non eseguito** |
| Segreti delle Actions | non leggibili da qui (il proxy blocca l'endpoint); il workflow del cron richiede `CRON_URL` e `CRON_SECRET` |

**Strategia proposta per Preview e Production**, da approvare e non applicata:
1. Il ramo predefinito resta il ramo di **produzione**: Vercel pubblica da lì.
2. `release/team-demo-2026-10-14` resta il ramo di **staging**: ogni commit genera un'anteprima con il suo database separato.
3. Il passaggio in produzione si fa con una PR release → ramo predefinito, unita solo dopo il collaudo su staging e la checklist di `PROEMIOS_GO_LIVE.md`.
4. Protezione consigliata sul ramo predefinito: PR obbligatoria, controllo `verify` verde e nessun push diretto. La imposta il proprietario del repository; non è stata attivata.
5. Le PR aperte superate vanno chiuse dal proprietario dopo una verifica. Non le ho chiuse.

## 2. Vercel

Né l'API né la dashboard di Vercel sono raggiungibili da questo ambiente. Lo stato viene dalle deployment registrate su GitHub e dal codice.

| Voce | Stato | Come |
|---|---|---|
| Progetto | `proemios` (team `valerio-gestri-s-projects`) | commenti del bot Vercel sulle PR |
| Branch di produzione | il ramo predefinito | deployment *Production* su `16fe696` |
| Build Command | lo script `vercel-build`, che Vercel usa se nel progetto non c'è un comando personalizzato | `package.json`; **da verificare** nelle impostazioni del progetto |
| Migrazioni in build | solo con `VERCEL_ENV=preview` **e** `RUN_MIGRATIONS_ON_PREVIEW=1`; in produzione la build si interrompe se la variabile è presente. Senza variabile: solo `next build` | `scripts/vercel-build.mjs`, test locale di entrambi i percorsi |
| Cron | `vercel.json`: `/api/cron` alle 5:00 UTC (piano Hobby: una volta al giorno). `/api/cron/frequent` non ha ancora un pianificatore | codice |
| Durata delle funzioni | `/api/cron` 300 s, `/api/cron/frequent` 60 s; la lavorazione AI è a passi brevi (vedi `PROEMIOS_EDITOR_AI.md`) | codice |
| Node e Next.js | Next 15.5, React 19; CI su Node 24; in locale Node 22. La versione Node impostata su Vercel va confermata | `package.json`, `ci.yml` |
| Variabili, domini, protezione delle deployment, log | **non verificabili da qui** | — |

## 3. Neon (database)

Non accessibile da questo ambiente. Un controllo precedente, fatto da te o da Cowork, ha trovato il database `proemios-staging-20261014` **senza le tabelle del CRM**: le migrazioni `0012` e `0013` non sono applicate lì.

| Voce | Stato |
|---|---|
| Schema Drizzle | `db/schema.ts`, `db/platform-schema.ts`, `db/crm-schema.ts`, `db/auth-schema.ts`, `db/document-schema.ts` (nuovo) |
| Migrazioni nel repository | da `0000` a `0014`. La `0014_document_studio` è nuova: documenti, versioni, suggerimenti, cicli di revisione, lavorazioni AI, costi |
| Rischio delle migrazioni | tutte additive (nuove tabelle e colonne con valori predefiniti), nessuna cancellazione né riscrittura di dati. Girano in una transazione: o passano tutte o nessuna |
| Prova su database nuovo | eseguite da zero su Postgres locale e su PGlite nei test, due volte (idempotenti) |
| Backup e ripristino | da fare prima di ogni migrazione su dati reali: un ramo Neon (*branch*) del database di produzione, che è un ripristino istantaneo; i passi sono in `PROEMIOS_GO_LIVE.md` |
| Database usati da Preview e Production | **da verificare** nelle variabili di Vercel. La Diagnostica dentro l'app mostra le migrazioni registrate in ciascun ambiente |

## 4. Integrazioni esterne

Riepilogo qui sotto; il dettaglio di funzioni, variabili, verifica e costi è in `PROEMIOS_INTEGRAZIONI.md`. Da questo ambiente rispondono le API di Anthropic e Google; quelle di Stripe, Resend, Fatture in Cloud e Vercel sono bloccate. In nessun caso ho credenziali dell'applicazione: niente qui sotto è verificato con il servizio reale.

| Servizio | Implementato | Verifica |
|---|---|---|
| Resend | email operative, coda con ritentativi, inviti, notifiche | test locali con trasporto su cartella |
| Stripe | checkout, webhook firmato, rate, rimborsi | test locali con eventi firmati simulati |
| Fatture in Cloud | fattura a ogni incasso, coda | test locali con API simulata |
| Vercel Blob | archivio privato dei file | test locali su cartella |
| Anthropic | analisi del manoscritto (esistente) e motore editoriale (nuovo) | test locali con client simulato |
| Google Workspace (Docs/Drive) | adattatore OAuth per i documenti (nuovo) | test locali con API simulata |
| Brevo | liste e webhook di disiscrizione | test locali |
| Google Analytics 4 | caricamento dopo il consenso | test locali |
| Pianificatore | `/api/cron` e `/api/cron/frequent` con blocco e registro | test locali |

## 5. Problemi trovati e azioni

| Problema | Azione |
|---|---|
| CRM non in produzione e staging senza migrazioni | migrazioni opzionali solo in anteprima (`vercel-build`), procedura in `PROEMIOS_GO_LIVE.md`; non applicate da me |
| Nessun tracciamento dei costi (AI, editor, altri) | nuova tabella dei costi di progetto e report di marginalità nel Super Admin |
| Numero di revisioni del contratto solo come testo libero | i cicli inclusi vanno indicati in modo strutturato (regola per servizio o valore per progetto, deciso da una persona); senza quel numero la richiesta del cliente non avvia lavorazioni automatiche |
| Upload limitato a 4 MB dal corpo delle funzioni Vercel | per manoscritti DOCX e TXT basta (un romanzo di 100.000 parole in DOCX pesa in genere meno di 1 MB). Per PDF grandi serve il caricamento diretto su Blob con token firmato: indicato come lavoro successivo, senza indebolire scanner e controlli |
| Cron frequente senza pianificatore | invariato: richiede la tua scelta (vedi `PROEMIOS_GO_LIVE.md`) |
| PR vecchie aperte | elencate sopra; nessuna azione automatica |
