# Percorso di acquisto: stati, continuità, conferma e promemoria

Descrive il comportamento effettivo dal ramo `claude/acquisto-continuo-20261015`.

## Stati, tenuti separati

| Livello | Dove | Valori |
|---|---|---|
| Commerciale | `platform_quote_records.commercial_state` | `estimate` (stima indicativa) · `review` (richiesta in valutazione) · `offer` (proposta definitiva acquistabile, con eventuale `expires_at`) · `accepted` |
| Pagamento | `platform_payment_orders` | `pending` (in elaborazione) · `paid` · `expired` · `failed` · `disputed` … |
| Progetto | `platform_projects.stage` | `materials` → `editing` → `review` → `approved` → `delivered` |

`journeyStage()` (`lib/platform/commercial.ts`) combina i primi due per l'autore: stima → in valutazione → acquistabile/scaduta → accettata in attesa di pagamento → pagamento in elaborazione → acconto confermato → pagamento completato.

Una stima non si può accettare (`409 NOT_PURCHASABLE`). Solo il team rende una proposta acquistabile (`POST quotes/:id/offer`, permesso `quote.write`); anche l'invio della proposta (`quotes/:id/send`) la rende acquistabile e traccia l'intervento commerciale. Le proposte create dal team nascono già `offer`.

## Regola di acquistabilità (`purchase-rule`)

Predefinita, prudente: diventano acquistabili da sole solo le richieste di **un servizio singolo a prezzo fisso di listino** (copertina, EPUB, pubblicazione KDP, assistenza ISBN, scheda Amazon). Servizi a parola (editing, correzione, impaginazione), percorsi completi, memoir, bozze e ghostwriting restano stime finché il team non verifica. Il proprietario cambia la regola in *Regole economiche → Cosa è acquistabile subito* (`autoOfferSingleServices`, `autoOfferFullPath`, `validityDays`).

### Come si compone il prezzo

Il listino (`config/pricing.ts`) non cambia; cambia solo la composizione quando il cliente indica che cosa vuole:

- **Un solo servizio** (dall’assistente della home con «Solo un servizio», dal configuratore o dai link `?singolo=1`): una sola proposta al prezzo di listino di quel servizio, senza impaginazione, EPUB, KDP o ISBN aggiunti. Le due porte danno lo stesso risultato.
- **Percorso completo con una revisione richiesta**: la revisione chiesta (editing o correzione bozze) sostituisce quella di base del pacchetto, non si somma. Essenziale usa la revisione chiesta; Consigliato porta sempre l’editing (livello superiore); Signature, il percorso completo, comprende editing e correzione insieme. Esempio 50.000 parole, testo da revisionare, chiesta la correzione bozze: 1.260 / 2.260 / 4.260 € invece di 2.210 / 2.710 / 4.260 €.
- **Editing e correzione chiesti insieme**: restano entrambi in ogni pacchetto.
- Ogni pacchetto mostra il **dettaglio voci** (servizi, sconto volume, maggiorazione tempi, minimo di progetto) sia nell’assistente sia nel configuratore.

Tre percorsi, derivati dai dati (`purchasePath`): `standard` (servizio singolo), `evaluation` (prezzo dipende dalla lettura), `complex` (memoir, solo materiali, bozza incompleta: brief → confronto → proposta per fasi).

## Continuità della scelta

1. Il risultato pubblico conserva il pacchetto scelto sulla proposta (`POST /api/preventivo/scelta` → `preferred_tier`) e manda a `/registrati?ritorno=/area-autore/conferma/<id>?pacchetto=<tier>`.
2. `ritorno` accetta solo percorsi interni (`safeReturnPath`) e viaggia attraverso registrazione, email di verifica (`/accedi?verificata=1&ritorno=…`) e accesso.
3. Dopo la verifica dell'email le richieste con lo stesso indirizzo vengono collegate (`lead-linking`), mai prima.
4. Email già registrata in fase di registrazione: la pagina propone il link di accesso via email o l'accesso con password, senza creare un secondo account.

### Accesso con link via email (autori)

Plugin `magicLink` di Better Auth: link monouso, 15 minuti, 3 richieste al minuto, solo per account esistenti (`disableSignUp`), nessuna email a indirizzi sconosciuti. Rifiutato per team, partner e per chiunque abbia la verifica in due passaggi attiva: quegli account entrano sempre con password e codice. Errori di link scaduto tornano su `/accedi?link=non-valido`.

## Pagina unica di conferma: `/area-autore/conferma/[id]`

Mostra la proposta in ogni stato. Per una proposta acquistabile riunisce servizio e pacchetto, quantità dichiarate, prestazioni incluse ed escluse, revisioni, tempi e avvio, importi (imponibile, IVA e totale dalla policy fiscale congelata sulla proposta: nessun calcolo IVA nell'interfaccia), dati di fatturazione precompilati, condizioni consultabili con versione, accettazione esplicita e un pulsante con l'importo esatto dell'acconto.

`POST quotes/:id/confirm` salva i dati di fatturazione (se inviati), accetta (idempotente) e apre il Checkout Stripe ospitato. Gestisce: proposta revisionata (`STALE_QUOTE` → ricarica), scaduta (`QUOTE_EXPIRED`), non acquistabile, sessione Stripe scaduta (`CHECKOUT_EXPIRED` → nuova sessione), doppio clic (ordine in attesa riusato, chiave di idempotenza Stripe), pagamento annullato (`?pagamento=annullato`), pagamenti asincroni (bonifico, SEPA: "in elaborazione" finché il webhook non conferma). La conferma dell'incasso arriva solo dal webhook firmato.

Acconto e saldo sono rate del contratto; eventuali rate del finanziatore (Klarna, Scalapay) riguardano solo l'importo pagato in quel momento e dipendono dai metodi attivati nella Dashboard Stripe: l'interfaccia non li promette.

## Area autore

La panoramica calcola il prossimo passo dallo stato reale (`nextActions` in `components/author/real-workspace.tsx`): valuta la proposta, conferma, completa il pagamento, carica il materiale, leggi il messaggio, approva la versione N, paga il saldo, scarica i file finali. Senza azioni: "il lavoro è in carico al team". Mostra referente (primo membro del progetto), fase, data di consegna solo se confermata (`due_at`), caricamento con avanzamento (XHR), versioni con "attuale/superata", approvazioni riferite alla versione, messaggi per progetto con conteggio non letti, notifiche non lette, fatture.

## Account del team

Scheda **Oggi** (`GET /api/platform/overview`, `lib/platform/overview.ts`): venditore (contatti senza proposta, richieste da valutare, offerte da ricontattare o in scadenza, accettate senza acconto, passaggi al team), editor/operatore (materiali attesi, in lavorazione con data, consegne in attesa dell'autore, attività in scadenza), coordinatore (progetti da assegnare, bloccati, carico per persona), Finance (fatture non emesse, ordini contestati, commissioni da liquidare, rettifiche preparate), proprietario (sei contatori, decisioni aperte, funnel 30 giorni).

**Permessi Finance**: il ruolo legge finanza e commissioni e prepara rettifiche (`refund.prepare` non è nel ruolo predefinito). `commission.pay` e `refund.authorize` restano deleghe esplicite del proprietario: l'interfaccia lo dichiara e la documentazione lo riflette. Nessun privilegio è stato ampliato.

## Attribuzione e commissioni

Nella proposta il team vede: responsabile del contatto (`lead_ownership.assigned_to`), origine (`leads.fonte`, UTM), affiliazione (`affiliate_conversions`), intervento commerciale (`sales_assisted`: revisione, invio o offerta da parte di un venditore), regola provvigionale congelata (`commission_policy`). La regola accetta `assistedSalesOnly`: con `true` il venditore matura la provvigione solo con un intervento tracciato; predefinito `false` per non cambiare gli accordi esistenti. Nessuna percentuale nuova.

## Promemoria (`reminder-rules`)

Eseguiti dal cron (`runReminders`): proposta non confermata (3 e 7 giorni), proposta in scadenza (2 giorni prima), accettata senza acconto (2 e 5 giorni), materiali mancanti dopo l'acconto (3 e 10 giorni), consegna senza decisione (3 e 7 giorni). Ogni regola rilegge lo stato: cambiato lo stato, niente invio. Chiave evento unica = nessun doppione. Il primo promemoria di una pratica è operativo; i successivi rispettano "notifiche facoltative" dell'account. Il responsabile sospende per proposta (`POST quotes/:id/reminders`) o per progetto (`POST projects/:id/reminders`). Nei test la posta resta nel trasporto isolato.

## Misurazione

`platform_funnel_events`: eventi d'interfaccia dal browser (`POST /api/eventi`: avvio, stima vista, pacchetto scelto, proposta vista, checkout aperto; senza cookie, IP o identità; rispetta Do Not Track) e fatti economici scritti dal server (proposta salvata, email verificata, valutazione richiesta, offerta, accettazione, checkout avviato, pagamento confermato). Il proprietario li vede distinti nella scheda Oggi. Nessuna percentuale di miglioramento viene dichiarata senza misure.

## Variabili d'ambiente nuove

Nessuna obbligatoria. Tutto il percorso funziona con quelle già documentate (`.env.example`, `docs/FATTURAZIONE_E_PAGAMENTI.md`). Migrazione `0007_commercial_states` da applicare con `npm run db:migrate`.
