# CRM unificato, pipeline, recuperi e consensi

## Stati della pipeline (`lib/platform/pipeline.ts`)

`received` · `quote_in_progress` · `quote_ready` · `quote_sent` · `accepted` · `checkout_started` · `payment_failed` · `recovery` · `negotiation` · `won` · `lost` · `unreachable`.

Derivati dai fatti (proposta, contratto, ordini Stripe): tutti tranne `received`, `recovery`, `negotiation`, `lost`, `unreachable`, che il team imposta a mano (`PATCH leads/:id {stage}`; `lost` e `unreachable` richiedono `lostReason`). `won` esiste solo con un incasso verificato: non si imposta e non si deduce dall'accettazione. I vecchi valori di `leads.stage` (`new`, `contacted`, `qualified`, `proposal`) vengono letti come sinonimi, senza migrazione dei dati.

Ogni contatto ha: responsabile unico (`platform_lead_ownership.assigned_to`), storia (`platform_lead_activities`: attività manuali, cambi di stato, assegnazioni, automazioni, import, consensi), prossima azione e scadenza (`next_action`, `next_action_at`), ultimo contatto, motivo di perdita, preferenze di canale (`contact_preferences`: email, telefono, WhatsApp, SMS), consenso alle comunicazioni facoltative con data e revoca, collegamenti a proposte, ordini, contratti e progetto (`GET leads/:id`).

## Origini

`leads.fonte`: `preventivo`, `analisi`, `contatto`, `agenzie` (sito) + `marketplace` (es. AddLance) + `import`. `source_detail` e `external_ref` conservano il dettaglio e l'id esterno. L'import (`POST leads/import`, CSV o JSON, permesso `crm.import` di owner e admin) e l'inserimento manuale di un contatto da marketplace (`POST leads` con `fonte`) non inviano nulla, non fanno scraping e ignorano i doppioni per email o riferimento (`409 DUPLICATE_LEAD`, attività "duplicate"). Nessun messaggio passa attraverso il marketplace.

## Attività manuali e canali

`POST leads/:id/activities {kind: call|whatsapp|sms|email|meeting|other, direction, body, outcome, nextAction?, nextActionAt?}`. WhatsApp e SMS si inviano dal telefono aziendale e si registrano qui; se la persona non ha ammesso il canale la registrazione in uscita è rifiutata (`409 CHANNEL_NOT_ALLOWED`). Nessun invio automatico su questi canali: le integrazioni risultano "predisposte" in `GET integrations`.

## Recuperi configurabili (`recovery-rules`)

Regola predefinita (`lib/platform/recovery.ts`): dopo un checkout avviato o fallito senza incasso, passo `reminder` (2 ore, email, scopo `cart`), `clarify` (24 ore, email, scopo `assistance`), `sales` (60 ore, attività per il venditore: telefonata/WhatsApp/SMS sui canali ammessi; il contatto passa a `recovery`). Soglie, canali, testi e scopo si cambiano in *Regole economiche → Recupero dei pagamenti non conclusi* o, dall'area Marketing, come bozza (`automation.draft`) attivata da chi ha `automation.activate`.

Prima di ogni passo l'engine rilegge lo stato: incasso arrivato, risposta della persona (attività in entrata), presa in carico del venditore (attività manuale dopo l'abbandono), stato chiuso o in negoziazione, recesso, canale email escluso o consenso mancante fermano tutto. Chiave evento per proposta+abbandono+passo = nessun doppione; `maxPerWeek` limita le email automatiche per contatto. Esecuzione: cron giornaliero (`/api/cron`) e pulsante *Operazioni → Esegui manutenzione*; con il piano Vercel Hobby il cron è al massimo giornaliero, quindi i ritardi in ore valgono "al primo giro utile" (Pro: fino a ogni minuto, vedi `docs/INTEGRAZIONI.md`).

Scopi e consensi (`emailAllowed`): `assistance`, `contractual`, `cart` richiedono informativa accettata e canale email non escluso; `marketing` richiede il consenso esplicito non revocato e porta il link di revoca firmato (`/api/consensi/revoca`). L'esistenza di un indirizzo email non basta mai. Le revoche arrivano dal link, dal team (`PATCH leads/:id {marketingConsent:false}`), dall'autore (preferenze) e dal webhook Brevo (disiscrizioni e rimbalzi).

## Negoziazione

Ogni variazione è una nuova versione della proposta (`PATCH quotes/:id`), mai una sovrascrittura di una proposta accettata. Lo sconto (`discountBps`) è ammesso entro `maxSellerDiscountBps` della regola di acquistabilità; oltre, serve chi gestisce le regole (`APPROVAL_REQUIRED`) e l'eccezione resta nella storia del contatto e nell'audit; `maxDiscountBps` è il tetto assoluto. Prima dello sconto l'interfaccia propone: rate del saldo (`POST quotes/:id/plan`, entro `maxInstallments`), servizio a fasi, pacchetto più essenziale, consulente. Le rate concesse dall'azienda (`company_installment`) sono distinte da quelle del provider (Klarna/Scalapay dentro Stripe, incasso unico per noi).

## Verifiche in test

Pipeline derivata e stati manuali, import con doppioni (JSON e CSV), presa in carico di un contatto da marketplace, canali ammessi, sequenza di recupero con stop su pagamento/risposta/presa in carico/canale escluso/consenso mancante, limite di frequenza, revoca via link, soglie di sconto con eccezione e storia.
