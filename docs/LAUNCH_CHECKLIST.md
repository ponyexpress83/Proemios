# Checklist di go-live

Proemios non va in produzione a fasi. Questa lista è il cancello: finché una
voce obbligatoria è aperta, non si va live.

Le voci contrassegnate **[umano]** non le può chiudere il codice: richiedono
credenziali, un account esterno, una decisione legale o commerciale, o un
pagamento reale.

## 1. Qualità del codice

- [x] TypeScript strict, nessun errore
- [x] ESLint pulito
- [x] 515 test unitari e di integrazione verdi
- [x] 31 test end-to-end su un'applicazione costruita
- [x] Build Next.js completa
- [x] Zero violazioni WCAG 2.1 A/AA su nove pagine (axe-core)
- [x] I DOCX generati si aprono con un lettore OOXML indipendente (LibreOffice)
- [x] La CSP non blocca il prodotto (verificato con un browser vero)

## 2. Sicurezza

- [x] Autorizzazione lato server in ogni pagina e azione
- [x] Isolamento fra tenant dentro la `WHERE`, provato su Postgres
- [x] 404 e non 403 per ciò che appartiene ad altri
- [x] DTO come allowlist, una forma per ruolo
- [x] Doppia approvazione strutturalmente obbligatoria
- [x] Chi approva editorialmente non approva la consegna dello stesso Job
- [x] CSP a nonce, HSTS, e le altre intestazioni
- [x] Limite di frequenza in database, provato in concorrenza
- [x] Firma verificata sui webhook Stripe e Inngest
- [x] Nessun segreto in codice, nei log o nei messaggi di errore
- [ ] **[umano]** Penetration test o revisione esterna
- [ ] **[umano]** Rotazione delle chiavi programmata

## 3. Dati e conformità

- [x] Migrazioni con rollback, provate andata e ritorno
- [x] Nessun manoscritto in database, nei log o negli analytics
- [x] Consensi separati, caselle mai pre-spuntate
- [x] Attribuzione senza dati personali
- [ ] **[umano]** Informativa privacy rivista da chi di dovere
- [ ] **[umano]** DPA firmato con ogni sub-responsabile (`PRIVACY.md`)
- [ ] **[umano]** Procedura di cancellazione scritta, con i termini fiscali
- [ ] **[umano]** Termini di conservazione dell'audit decisi
- [ ] **[umano]** Banner di consenso, **se** si attivano tag di profilazione

## 4. Infrastruttura

- [ ] **[umano]** Dominio `proemios.it` su Vercel (mai `proemios.com`)
- [ ] **[umano]** Database Neon in regione UE, con backup automatici
- [ ] **[umano]** Bucket S3 UE: accesso pubblico bloccato, cifratura,
      versioning, credenziali minime sul prefisso
- [ ] **[umano]** Dominio email verificato su Resend (SPF, DKIM, DMARC)
- [ ] **[umano]** `INNGEST_SIGNING_KEY` in produzione e `/api/inngest`
      registrato
- [ ] **[umano]** `DEMO_MODE=off` verificata sull'ambiente di produzione

## 5. Commerciale

- [x] `config/pricing.ts` invariato; nessun prezzo esiste fuori di lì
- [x] Acconto al 40%, come approvato
- [x] Servizi senza tariffa approvata marcati «su preventivo»
- [ ] **[umano]** Stripe in modalità live, con il webhook configurato
- [ ] **[umano]** Fatture in Cloud collegato, o decisione esplicita di emettere
      a mano
- [ ] **[umano]** Un pagamento di prova end-to-end, con importo reale minimo
- [ ] **[umano]** Testo dei contratti rivisto legalmente

## 6. AI

- [x] Il router rifiuta i provider senza policy privacy approvata
- [x] Il livello di servizio limita le categorie di intervento
- [x] Nessuna proposta raggiunge il cliente senza revisione umana
- [ ] **[umano]** `provider_policies` popolata con i dati veri dei contratti
- [ ] **[umano]** Chiavi API di produzione, con tetto di spesa impostato

## 7. Marketing

- [x] Eventi di navigazione nel dataLayer, senza dati personali
- [x] Eventi di esito registrati lato server, con attribuzione congelata
- [x] `robots.txt` esclude tutte le aree riservate
- [x] Sitemap senza percorsi privati
- [x] 301 dai vecchi indirizzi
- [ ] **[umano]** GTM configurato e i tag pubblicati
- [ ] **[umano]** Azioni di conversione create in Google Ads e mappate in
      `GOOGLE_ADS_AZIONI`
- [ ] **[umano]** Search Console verificata, sitemap inviata

## 8. Operatività

- [x] Documentazione: architettura, dati, RBAC, motore DOCX, commercio,
      analytics, sicurezza, privacy, operazioni, rilascio, ambiente
- [x] Runbook per i guasti frequenti (`OPERATIONS.md`)
- [ ] **[umano]** Lavori periodici schedulati (conversioni, pulizia limitatore,
      cancellazione estratti)
- [ ] **[umano]** Monitoraggio e avvisi (errori, 5xx, coda dei job)
- [ ] **[umano]** Il primo amministratore creato con `db:seed`
- [ ] **[umano]** Chi risponde quando qualcosa si rompe, e con che tempi

## La prima settimana

Da guardare ogni giorno: conversioni non inviate, fatture in `errore`, Job in
`failed`, notifiche con `erroreInvio`, e il numero di 429 — se sono molti, o il
limite è troppo stretto o c'è un abuso.
