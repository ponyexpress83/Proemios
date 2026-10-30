# Proemios 2.0: messa in produzione

Data: 18/10/2026. Nessuno di questi passi è stato eseguito: richiedono la tua autorizzazione e, in parte, accessi che da qui non ho (Vercel, Neon, Google Cloud, Anthropic).

## 0. Decisioni da prendere prima

| Decisione | Dove |
|---|---|
| Fornitore AI e trattamento dei dati (Anthropic): termini, conservazione, informativa ai clienti | contratto e privacy (nessun documento legale pubblicato da me) |
| Regole AI: modello, impegno, tetto per lavorazione, tetto mensile, avvio automatico delle revisioni incluse, assistente commerciale | Impostazioni CRM → AI, costi e revisioni |
| Cambio USD→EUR per i report | stessa sezione |
| Cicli di revisione inclusi per servizio, o per progetto | stessa sezione; Studio → Cliente e condivisione |
| Uso di Google Docs (sì/no) e progetto Google Cloud | Google Cloud Console |
| Pianificatore del lavoro frequente (GitHub Actions, cron-job.org o Vercel Pro) | vedi `CRM_MESSA_IN_USO_2026-10-17.md` |
| Strategia dei rami e protezione del ramo predefinito | `PROEMIOS_AUDIT_COMPLETO.md` §1 |

## 1. Staging

1. Unisci questa PR nella release, solo dopo la revisione.
2. Database di staging:
   1. crea un ramo Neon di sicurezza;
   2. applica le migrazioni fino a `0014`, con `npm run db:migrate` e `DATABASE_URL` di staging, oppure con `RUN_MIGRATIONS_ON_PREVIEW=1` per una sola build di anteprima;
   3. controlla Impostazioni CRM → Diagnostica (database e migrazioni «Verificato»).
3. Imposta su Preview: `EDITORIAL_AI_ENABLED=1`, `ANTHROPIC_API_KEY` (chiave con limite di spesa basso), facoltativamente `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, e `CRON_SECRET` se manca.
4. Esegui il collaudo di `PROEMIOS_COLLAUDO.md` («Da ripetere su staging»).
5. Aggiorna gli stati in questi documenti: «Verificato su staging» solo per ciò che hai provato davvero.

## 2. Produzione

1. Backup verificato: crea un ramo Neon del database di produzione e prova a leggerlo prima di procedere.
2. Applica le migrazioni al database di produzione, una sola volta e a mano (non durante la build): `npm run db:migrate` con il `DATABASE_URL` di produzione. Sono tutte additive.
3. Variabili di produzione: come staging, ma con la chiave Anthropic di produzione e i limiti approvati. Lascia `EDITORIAL_AI_ENABLED=0` finché le regole non sono approvate in produzione.
4. Unisci la release nel ramo predefinito con una PR. Il ramo di produzione resta quello predefinito: non va cambiato.
5. Dopo la pubblicazione:
   - controlla la Diagnostica;
   - fai una lavorazione AI su un testo interno di prova;
   - verifica il costo nella Cabina di regia.
6. Solo allora attiva `EDITORIAL_AI_ENABLED=1` e, se lo vuoi, l'avvio automatico delle revisioni incluse.

## 3. Ritorno indietro

| Cosa | Come |
|---|---|
| Fermare l'AI senza pubblicare | Cabina di regia → Controllo delle automazioni → Lavorazioni AI → Sospendi; oppure `EDITORIAL_AI_ENABLED=0` |
| Codice | ripubblica la deployment precedente da Vercel (le tabelle nuove non danno fastidio al codice vecchio) |
| Dati | ripristino dal ramo Neon creato al punto 2.1 |
| Google | revoca dall'account Google; Proemios segna il collegamento come revocato |

## 4. Variabili nuove

| Variabile | Obbligatoria | Note |
|---|---|---|
| `EDITORIAL_AI_ENABLED` | no (predefinito spento) | `1` per abilitare il motore editoriale e l'assistente |
| `ANTHROPIC_API_KEY` | per l'AI | già usata dall'analisi del manoscritto |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | per Google Docs | client OAuth «Web» |
| `GOOGLE_REDIRECT_URI` | no | predefinito `<APP_URL>/api/integrations/google/callback` |
| `CRON_SECRET` | sì | protegge anche `/api/jobs/ai` |
| `BLOB_READ_WRITE_TOKEN` | sì | file privati; serve anche al caricamento diretto dei file oltre 4 MB |
| `UPLOAD_DIRECT_MAX_MB` | no | predefinito 40, massimo 100 |
| `FILE_SCANNER_URL`, `FILE_SCANNER_TOKEN` | sì per DOCX/PDF | senza scanner si accettano solo TXT; risposta attesa `{"clean": true\|false}` |

Il prompt operativo per eseguire questi passi (Claude Code per la correzione rimasta, Claude Cowork per staging e produzione) è in `docs/PROMPT_CHIUSURA_LANCIO.md`. La PR di lancio (release → ramo predefinito) è aperta in bozza e va unita solo dopo il collaudo.
