# Candidato Proemios — 8 ottobre 2026

Stato: **bloccato per l’uso reale**, candidato da revisionare in preview. Nessuna promozione, merge, modifica DNS, invito a persone reali o movimento economico.

Base preservata: `57cedee1e54fd3fc50e0be18731764f4bba01653`, PR14 ancora draft. Riprese anche le modifiche locali della precedente branch `codex/proemios-production-20261007`, senza sovrascriverle. Nuova branch `codex/proemios-production-20261008`. Default remoto e produzione osservata: `16fe6960d8871b10141f251cfc9c55a2305b43a5`. La preview storica 57cedee non dimostrava i nuovi moduli.

Stack effettivo: Next 15.5.22, React 19, TypeScript, Node 24; Drizzle 0.45.2/Postgres, Better Auth 1.7.7/TOTP, Resend, Stripe, Anthropic e Blob privato. Nessun nuovo abbonamento attivato.

## Fasi

| Fase | Risultato verificabile | Dipendenza ancora aperta |
|---|---|---|
| 00–01 | Repository/deploy verificati; audit e 40 URL inventariati; registro 74 ID | Identità, policy e servizi esterni |
| 02 | Auth reale, verifica/reset, MFA, inviti, deleghe, revoche e admin CRM-only provati in DB isolato | DB/email staging, email Valerio e Alberto; ambito gruppo |
| 03 | Progetti separati, messaggi privati/interni, file TXT, revisioni e approvazioni versionate | Blob/scanner e conservazione editoriale approvati |
| 04 | CRM persistente, prezzi server, claim protetto, snapshot/revisione proposta, PDF | Percorso UI completo nello staging, validità commerciale |
| 05 | Ledger idempotente, incassi asincroni, provvigioni e rettifiche proporzionali provati | Stripe test, IVA/regole approvate, documenti fiscali/processo economico |
| 06 | Identità grafica conservata, SEO centralizzato, demo venditore tolta, noindex | Verifica browser attuale completa e dati editoriali/legali |
| 07 | Outbox cifrata e retry, jobs persistenti/gated, manutenzione con cancellazione testata | Provider, regioni, limiti/costi, cron/alert e backup live |
| 08 | Typecheck/lint, 105 test (31 integrazione), build locale; PR15 draft e preview6e55961 READY | Nessun percorso con provider reale certificato; lancio vietato finché gate falliscono |
| 09 | Preferenze, PDF, link protetto, aiuto, notifiche e backlog | Filtri salvati applicati e revisione UI implementati; flusso browser autenticato bloccato dai provider |

## Configurazione osservata

Progetto Vercel `proemios`, team `valerio-gestri-s-projects`. Lettura delle variabili senza decifrazione: nessuna variabile restituita e hiddenProductionEnvCount=0. Questo non certifica connettività dei provider. Le funzioni dipendenti restano disabilitate se mancano i requisiti. `proemios.it` non è fra i domini del progetto; `proemios.vercel.app` è il dominio associato. Non si dichiara online il dominio ufficiale.

Nessun account reale creato o invitato. Le identità `example.test` esistono soltanto nel database temporaneo dei test. Gli invii restano nel trasporto locale isolato e non raggiungono clienti.

Consulta `BUSINESS_INPUTS.md`, `ACCOUNTS.md`, `DATA.md`, `RUNBOOK.md`, `RELEASE.md`, `BACKLOG.md`, `requirements/registry.csv` ed `evidence/` per risultati e criteri. Le voci da verificare non sono dichiarate risolte.

Runtime locale verificato: 74 URL (incluse le 40 storiche), 62 risposte200, 6 redirect307 e 6 vere404. Dieci endpoint dipendenti rispondono503 controllato senza servizi. I dettagli sono in evidence/runtime.json.

Preview6e55961: Vercel READY, desktop1363×936, libro→stima completato senza dati personali, Escape/focus e slider da tastiera verificati. Accesso/analisi mostrano attivazione; header avorio e footer blu confermati. Evidence/browser.json distingue i limiti (sei viewport/zoom/reduced motion e provider autentici non certificati).
