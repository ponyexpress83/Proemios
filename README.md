# Proemios

Sito editoriale Next.js/React e candidato operativo per autori e team. Identità pubblica conservata: barra avorio, footer blu scuro, logo attuale, libro interattivo, sei scene e cinque percorsi.

**Stato: candidato bloccato per l’uso reale.** Auth personale/TOTP, progetti, CRM, proposte/PDF, ledger, outbox e jobs persistenti sono implementati. Le prove locali non certificano provider, dominio o account reali. Vedere [stato e requisiti](docs/production/STATUS.md) e [checklist](docs/production/RELEASE.md).

## Avvio

Node 24, `npm ci`. Copiare `.env.example` in un file protetto locale e configurare solo servizi autorizzati. `npm run dev`; per verifica `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Le nuove integrazioni richiedono Postgres e servizi elencati nell’esempio. Nessuna chiave reale nel repository.

`npm run db:migrate` applica migrazioni additive: prima backup/restore e prova staging. Non usare db:push/reset su dati live. Seed soltanto test isolati. Test integrazione usa PostgreSQL PGlite, identità sintetiche e trasporti locali privati: nessuna email o transazione esterna.

## Sicurezza e ambienti

Missing DATABASE_URL non abilita demo. DEMO_MODE è esplicito e mai attivo in produzione. Endpoint dipendenti rispondono 503 se non configurati; nessuna dashboard sintetica allo spazio reale. `/area-autore`, `/area-team` e `/admin` portano allo spazio autenticato, senza Basic Auth o password condivise. I permessi sono verificati sul server per risorsa; nascondere il menu non autorizza l’API.

NEXT_PUBLIC_SITE_URL resta `https://proemios.it`; APP_URL/BETTER_AUTH_URL identificano l’origine applicativa autorizzata della preview/produzione. Preview noindex; PROEMIOS_PRODUCTION_READY soltanto dopo i gate. Nessun deploy produzione autorizzato da questa PR.

Auth Better Auth 1.7.7 con password hash della libreria, verifica email e TOTP staff. Sessioni DB senza cookie cache; deleghe/revoche personali. Bootstrap owner vincolato all’email verificata autorizzata e una tantum, da chiudere dopo uso. Nessun account reale o invito inventato.

AI e pagamenti sono subordinati a configurazione e policy approvate. Analisi: metriche sull’intero file, giudizio su estratto fino 8000 parole, file massimo4MB, concorrente massimo1, quote approvate, report solo se provider riesce. Blob private/scanner necessari per file binari. PDF preventivo e accettazione app distinti da fattura/firma elettronica.

Documentazione: [account](docs/production/ACCOUNTS.md), [input aziendali](docs/production/BUSINESS_INPUTS.md), [dati](docs/production/DATA.md), [gestione](docs/production/RUNBOOK.md), [backlog](docs/production/BACKLOG.md). Gli audit precedenti in evidence sono storici, non risultati dell’attuale versione. Le note di demo di altre consegne non sono istruzioni operative per questa versione.
