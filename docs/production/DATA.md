# Dati e conservazione

| Categoria | Accesso/finalità | Destinazione prevista | Scadenza effettiva nel codice | Da approvare/verificare |
|---|---|---|---|---|
| Identità/sessioni/TOTP | Provider auth e gestione autorizzata | Postgres; password hash Better Auth, TOTP protetto dalla libreria | Sessioni 7d autore/12h staff; inviti 48h | Regione DB, recupero owner, conservazione identità |
| Lead/agenzie/proposte | CRM assegnato o grant organizzazione; autore solo dopo claim | Postgres e Resend per comunicazioni necessarie | Nessuna cancellazione aziendale arbitraria | Termini/proposte e conservazione CRM approvati |
| File e revisioni editoriali | Membri autorizzati; download via server con no-store | Blob private; scanner autenticato | Quarantena massimo 7 giorni tecnici; pronti senza scadenza finché policy non definita | Regione/scanner, conservazione progetto, copie e backup |
| Estratto analisi | Solo richiedente autorizzato; metriche sul testo intero, giudizio fino 8000 parole | Blob private e Anthropic; niente strumenti/altre risorse nel prompt | MANUSCRIPT_RETENTION_DAYS obbligatorio approvato; cleanup cancella oggetto, report e metriche | Provider/regione/budget, esecuzione cron e retention backup |
| Report/messaggi/notifiche | Report propri; messaggi progetto; note interne solo staff autorizzato | Postgres; email senza manoscritto completo | Nessun termine arbitrario per progetto | Policy categorie e accesso supporto |
| Outbox | Solo ops, HTML JWE a riposo; link/token mai esposti nell’API ops | Postgres e Resend | Max5 tentativi automatici; lease e backoff | Retention mail, consegna reale vs accepted, chiavi cifratura |
| Ledger/documenti/commissioni | Finance/grants dedicati; seller e affiliate solo propri dati minimizzati | Postgres e Stripe; carte mai nell’app | Non eliminati al semplice delete account | Regole fiscali, conservazione, gestionale approvato |
| Audit/limiti/idempotenza | Solo operatore autorizzato; sicurezza/dedup | Postgres | Limiti >7d puliti; chiavi a scadenza; audit senza testi/token | Termine audit, alert, retention approvata |
| Richieste privacy | Identità richiedente verificata e operatore ops | Postgres, processo manuale | Richiesta tracciata; niente cancellazione finanziaria automatica | Referente/processo/risposta verificata; export completo ancora da eseguire |

Fornitori elencati sono integrazioni previste, non attestazioni di contratti attivi o regione effettiva. Nessun dato personale live migrato/eliminato. Restore testato solo DB sintetico; copertura file e copie nei backup da certificare sul piano reale. Nessuna promessa pubblica di cancellazione entro 30 giorni.
