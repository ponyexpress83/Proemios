# Collegamenti esterni: stato, configurazione, costi e limiti

Stato visibile in *Marketing → Collegamenti esterni* (`GET integrations`, permesso `integrations.manage`) e in *Operazioni*. Le credenziali stanno solo nelle variabili d'ambiente; l'interfaccia mostra "configurato / da collegare" e un dettaglio non sensibile.

Legenda: **operativo** = codice completo e già usato in test; **predisposto** = codice presente, attivabile con credenziali o decisione; **mancante** = non implementato per scelta.

| Servizio | Stato nel codice | Variabili | Note |
|---|---|---|---|
| Stripe Checkout + webhook | operativo | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_METHODS` | eventi gestiti: checkout completato/asincrono/scaduto/fallito, rimborsi (creati/aggiornati, anche richiesti dalla piattaforma), contestazioni aperte/chiuse. Rimborsi dalla piattaforma con `refund.authorize`. |
| Resend (email operative) | operativo | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_INTERNAL` | outbox con ritentativi, allegati (contratto) letti dallo storage; nessun webhook di rimbalzo (predisposto in Brevo). |
| Fatture in Cloud | operativo (da collegare) | `FIC_ACCESS_TOKEN`, `FIC_COMPANY_ID`, `FIC_SEND_TO_SDI`, `FIC_VAT_ID`, `FIC_VAT_ID_EXEMPT`, `FIC_PAYMENT_ACCOUNT_ID` | vedi `docs/FATTURAZIONE_E_PAGAMENTI.md`. Nessuna fattura reale nei test. |
| Vercel Blob (storage privato) | operativo (da collegare) | `BLOB_READ_WRITE_TOKEN` | contratti e file dei progetti. Senza token: contratti rigenerati dallo snapshot, upload non disponibili. |
| Google Analytics 4 | predisposto | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | script caricato solo dopo consenso esplicito (banner, Consent Mode v2 in modalità di base, `anonymize_ip`, niente segnali pubblicitari); eventi di marketing senza dati personali; `purchase` solo dopo conferma lato server. Prima di attivarlo aggiornare `/cookie` (bozza sotto) e far validare il banner. |
| Brevo | predisposto | `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_WEBHOOK_SECRET` | sincronizzazione dei contatti autorizzati (nome, email, origine; lista `BREVO_LIST_ID`; blacklist quando revocato) e webhook `/api/webhooks/brevo` (segreto condiviso via header `x-proemios-webhook-secret` o `?t=`, dedup, revoche/rimbalzi/segnalazioni → consenso revocato e canale email escluso). Nessun editor di campagne nella piattaforma. KPI delle campagne (aperture, clic) "da collegare": richiedono la lettura dei report via API, non inclusa. |
| Google Ads / Meta Ads | predisposto (manuale) | — | registro campagne + link tracciati + import spesa CSV. Nessun collegamento API: richiede account sviluppatore, token OAuth con rinnovo e revisione; valutare più avanti se la spesa lo giustifica. |
| WhatsApp Business / SMS | predisposto (manuale) | — | attività registrate dal venditore; nessun invio automatico. Un provider (es. API WhatsApp Cloud, SMS) richiede opt-in esplicito per canale, template approvati e costi per messaggio. |
| Looker Studio | facoltativo | — | sorgenti possibili: export CSV contatti (`leads/export`) e registro (`finance/export`), o connettore Postgres in sola lettura su viste dedicate (da creare). |
| Analisi manoscritto (Anthropic) | invariato | `ANTHROPIC_API_KEY`, `ANALYSIS_*` | fuori dal perimetro di questa consegna. |

## Costi ricorrenti e limiti (da verificare sui listini ufficiali prima di decidere)

Le cifre qui sotto vengono da pagine pubbliche consultate il 16 ottobre 2026 e in parte da fonti terze: vanno confermate sui siti dei fornitori.

- **Resend**: piano gratuito 3.000 email/mese con massimo 100/giorno; Pro circa 20 $/mese per 50.000 email. Allegati: controllare il limite per messaggio nella documentazione (il contratto PDF pesa poche decine di KB).
- **Brevo**: gratuito 300 email/giorno con logo Brevo; Starter da circa 9 $/mese senza limite giornaliero; webhook e API inclusi. Le fonti sono siti di recensioni: verificare brevo.com.
- **Stripe**: commissioni per carta europea nell'ordine dell'1,5 % + importo fisso per transazione, maggiori per carte extra-UE, Klarna e Scalapay; bonifico tramite Stripe con commissione propria. Verificare `stripe.com/it/pricing` e i listini BNPL per i merchant italiani.
- **Fatture in Cloud**: piani annuali (fonti terze riportano da circa 144 a 612 € + IVA/anno a seconda del piano); fatturazione elettronica via SdI inclusa. L'accesso API richiede un piano che lo preveda: verificare sul sito.
- **Google Analytics 4**: gratuito; costo in conformità (banner, informativa, scelta della modalità di consenso).
- **Vercel**: cron Hobby al massimo una volta al giorno con precisione oraria; Pro fino a ogni minuto. I recuperi "dopo N ore" con Hobby partono al primo giro giornaliero utile.
- **Google Ads / Meta Ads**: nessun costo di integrazione; spesa pubblicitaria decisa a parte e mai attivata dal codice.

## Configurazioni esterne richieste (nessun segreto qui)

1. Stripe: chiave live + endpoint webhook `/api/webhooks/stripe` con gli eventi `checkout.session.*`, `refund.created`, `refund.updated`, `charge.dispute.created`, `charge.dispute.closed`; metodi di pagamento attivati nella Dashboard (carte, bonifico, Klarna/Scalapay se desiderati).
2. Resend: dominio verificato, `EMAIL_FROM` sul dominio, `EMAIL_INTERNAL` per il team.
3. Vercel Blob: store privato e token.
4. Fatture in Cloud: token API, id azienda, id aliquota e conto d'incasso (verifica dal pannello Finance senza creare documenti).
5. Brevo (facoltativo): chiave API con ambito contatti, una lista dedicata, un webhook "transazionale + marketing" verso `/api/webhooks/brevo?t=<segreto>` per gli eventi disiscrizione, rimbalzo duro, spam, bloccato.
6. GA4 (facoltativo): proprietà e ID di misurazione; aggiornamento della pagina `/cookie`.
7. Cron: `CRON_SECRET`; con Hobby lo schedule resta giornaliero.

## Bozza di testo per `/cookie` prima di attivare GA4 (non pubblicata)

> **Statistiche di traffico.** Con il tuo consenso usiamo Google Analytics 4 per misurare in forma aggregata le pagine visitate, l'uso del configuratore e gli acquisti conclusi. Lo strumento si attiva solo se accetti nel riquadro che compare alla prima visita; gli indirizzi IP sono anonimizzati, i segnali pubblicitari e la personalizzazione degli annunci sono disattivati e non inviamo dati personali (nome, email, testi). Puoi cambiare scelta in qualsiasi momento da questa pagina. Titolare del trattamento per conto nostro: Google Ireland Limited, con trasferimento negli Stati Uniti nell'ambito del Data Privacy Framework.

Da aggiungere a `RESPONSABILI_ESTERNI` in `config/legal.ts` (Google e, se attivato, Brevo) prima dell'attivazione. Testo da far validare: non è un parere legale.
