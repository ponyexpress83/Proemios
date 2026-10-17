# Fatturazione automatica e metodi di pagamento

## Cosa succede a ogni incasso

1. Stripe conferma il pagamento (webhook `checkout.session.completed` o `async_payment_succeeded`).
2. Nella stessa transazione la piattaforma registra l'incasso, le commissioni e **mette in coda la fattura** (`platform_invoices`, stato `queued`).
3. Subito dopo la risposta a Stripe, e a ogni giro del cron, `issueQueuedInvoices` crea il documento su Fatture in Cloud (API v2, `POST /c/{company}/issued_documents`), con prezzi lordi uguali al centesimo all'addebito Stripe, pagamento registrato come saldato e dati per la fattura elettronica.
4. Con `FIC_SEND_TO_SDI=1` la fattura viene trasmessa subito allo SdI (stato `sent`); altrimenti resta in Fatture in Cloud da inviare a mano (stato `created`).
5. L'autore riceve notifica ed email; scarica il PDF dalla sua area (`/api/platform/invoices/:id/pdf`, servito dalla piattaforma). Il team riceve un'email con l'esito.
6. Un errore dell'API non blocca l'incasso: la riga passa a `retry` con attesa crescente (5 min, 10, 20… fino a 6 ore), dopo otto tentativi a `failed`. Finance la vede nella scheda **Finance → Fatture emesse** e può premere **Riprova**.

Acconto e saldo generano due fatture distinte; quella del saldo cita la fattura di acconto (numero e data).

## Attivazione e verifica del collegamento

L’emissione è già automatica nel codice: si accende quando esistono `FIC_ACCESS_TOKEN` e `FIC_COMPANY_ID`. Per non indovinare gli id:

1. In Fatture in Cloud → Impostazioni → API crea un token con gli ambiti **Fatture emesse (lettura e scrittura)** e **Impostazioni (lettura)**; annota l’id azienda.
2. Imposta le due variabili nell’ambiente (anteprima prima, produzione poi) e rilancia il deploy.
3. In **Finance → Fatturazione automatica** premi **Verifica il collegamento**: la piattaforma chiama `GET /api/platform/invoices/status?verifica=1`, che legge azienda, aliquote e conti d’incasso **senza creare documenti** ed elenca gli id da copiare in `FIC_VAT_ID` e `FIC_PAYMENT_ACCOUNT_ID`.
4. Fai un incasso di prova in modalità test di Stripe, controlla la fattura creata (stato `created`, non trasmessa) e solo poi imposta `FIC_SEND_TO_SDI=1`.

Le fatture in coda vengono riprovate a ogni webhook Stripe, ogni notte dal cron e ogni volta che Finance apre la propria scheda; quelle in errore si riprovano con **Riprova**.

## Dati di fatturazione

Senza dati di fatturazione il checkout risponde `409 BILLING_REQUIRED`. L'autore li inserisce una volta nella sezione Pagamenti (`PUT /api/platform/me/billing`): persona fisica con codice fiscale, oppure azienda con partita IVA e codice destinatario o PEC. Gli stessi dati creano il cliente Stripe (serve per bonifico e rate).

## Variabili d'ambiente

| Variabile | Uso |
|---|---|
| `FIC_ACCESS_TOKEN` | Token manuale (Fatture in Cloud → Impostazioni → API) o OAuth con ambito `issued_documents.invoices:a`. |
| `FIC_COMPANY_ID` | Id azienda su Fatture in Cloud. |
| `FIC_SEND_TO_SDI` | `1` per trasmettere subito allo SdI. Lasciare `0` finché le prime fatture non sono state controllate. |
| `FIC_VAT_ID` | Id aliquota (0 = 22% nei conti standard). |
| `FIC_VAT_ID_EXEMPT` | Id aliquota esente, solo se la policy è `exempt`. |
| `FIC_PAYMENT_ACCOUNT_ID` | Conto d'incasso (es. "Stripe") su cui registrare il pagamento. |
| `STRIPE_PAYMENT_METHODS` | Vuoto: decide la Dashboard Stripe. Oppure elenco esplicito (`card,klarna,customer_balance`). |

## Rate, rimborsi e contestazioni

- **Rate del saldo concesse dall'azienda**: ordini `kind = balance` con `sequence` 1..N e `plan = company_installment`; importi calcolati dal server (`installmentSchedule`), l'ultima rata assorbe l'arrotondamento. Ogni rata incassata genera la propria fattura di saldo. Distinte dalle rate Klarna/Scalapay (pagamento unico per noi; `payment_method` registrato quando Stripe lo indica).
- **Rimborsi**: Finance prepara (`POST refunds`, `refund.prepare`, nessun movimento); un **secondo** utente con `refund.authorize` e verifica in due passaggi recente autorizza (`POST refunds/:id/authorize`): la piattaforma chiama Stripe (`refunds.create`, chiave di idempotenza `proemios-refund-<id>`), e solo l'evento `refund.updated` verificato scrive registro, stato dell'ordine (`partially_refunded`/`refunded`) e storni delle commissioni; la richiesta passa a `executed`. Errore del provider → `failed`, riautorizzabile. Nessuna nota di credito automatica su Fatture in Cloud: da emettere a mano (limite dichiarato).
- **Contestazioni**: `charge.dispute.created` → ordine `disputed` e commissioni trattenute; `charge.dispute.closed` con esito `won` → torna `paid`, altrimenti `review_required`.
- **Recesso del consumatore**: blocca nuovi checkout (`WITHDRAWN`); il rimborso segue il percorso sopra.
- **Progetto**: creato dal webhook al primo acconto verificato (una sola volta per proposta); la lavorazione (`editing`) parte dopo l'incasso previsto per il servizio (`purchase-rule.startAfter`, predefinito acconto); la consegna finale (`delivered`) richiede il saldo completo se `balanceBeforeDelivery` è attivo.

## Pagina unica di conferma

L'autore accetta e paga da `/area-autore/conferma/[id]` (vedi `docs/PERCORSO_DI_ACQUISTO.md`): dati di fatturazione, accettazione e checkout in una chiamata (`POST quotes/:id/confirm`). Solo una proposta in stato `offer` è acquistabile.

## Metodi di pagamento in Stripe

Il Checkout non fissa i metodi: espone quelli attivati nella Dashboard Stripe (Impostazioni → Metodi di pagamento). Per il rateale con incasso immediato attivare **Klarna** e **Scalapay** (Scalapay richiede l'accordo con Scalapay dalla Dashboard). Per gli importi alti attivare **Bonifico** (Stripe assegna un IBAN virtuale per cliente e riconcilia da solo, nessuna contestazione possibile) e, se accettabile il rischio di storno a 8 settimane, **Addebito SEPA**. I pagamenti asincroni (bonifico, SEPA) risultano "in attesa" finché Stripe non conferma: la piattaforma li gestisce già.
