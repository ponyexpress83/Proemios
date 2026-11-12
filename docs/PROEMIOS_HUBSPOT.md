# Proemios: CRM commerciale su HubSpot

Data: 12/11/2026. Stesso schema di ProntoSito: **HubSpot è il CRM delle persone, Proemios il motore del prodotto e dei soldi.**

| Area | Dove vive |
|---|---|
| Contatti, trattative, attività, note, email e sequenze commerciali, marketing | HubSpot |
| Richieste dal sito, proposte con prezzo di listino, contratti, pagamenti Stripe, fatture | Proemios |
| Produzione: passaggio, assegnazioni, Studio, AI editoriale, consegne, revisioni | Proemios |
| Provvigioni (calcolate solo sugli incassi verificati) | Proemios |
| Email transazionali (accesso, contratto, ricevute, avvisi) | Resend |

## Cosa arriva in HubSpot

La sincronizzazione legge il registro degli eventi stabili (`crm_events`) nel lavoro frequente (`/api/cron/frequent`). Non è mai sul percorso di pagamenti, registrazioni o contratti. Se HubSpot non risponde, gli eventi restano in attesa e si riprovano in ordine al giro successivo.

| Evento in Proemios | Cosa succede in HubSpot |
|---|---|
| Nuova richiesta (sito, preventivatore, analisi, inserimento a mano) | **Contatto** (nome, cognome, telefono, `proemios_origine`). **Trattativa** nella prima fase della pipeline, con il responsabile. **Attività** «Primo contatto», con scadenza di 4 ore lavorative. Se il commerciale ha già una trattativa aperta per quel contatto, Proemios la collega invece di crearne una nuova |
| Contratto accettato | Fase «contratto accettato». Importo del pacchetto, servizio e pacchetto |
| Acconto verificato da Stripe | Trattativa **vinta**. Righe d'ordine dal pacchetto (una volta sola). **Attività per la produzione** «Acconto incassato: avvia la produzione», assegnata a `HUBSPOT_OPS_OWNER_EMAIL` (Alberto) |
| Saldo o rata verificati | Incasso registrato sulla trattativa (`proemios_incassi`) |
| Passaggio alla produzione | Progetto e stato della produzione sulla trattativa |

**Responsabile della trattativa:** è il commerciale che la segue in Proemios, riconosciuto dalla stessa email in HubSpot. Se non c'è, è `HUBSPOT_SALES_OWNER_EMAIL`.

**Scadenze delle attività:** cadono dentro l'orario di lavoro, lun-ven 10-17 ora di Roma (`HUBSPOT_WORK_HOURS`).

**Idempotenza.** Ogni trattativa porta `proemios_deal_id`, le righe portano il riferimento della proposta e le attività un marcatore nel testo. Ritentativi e ripartenze non creano doppioni.

**Cosa non va in HubSpot:**
- manoscritti e testi;
- dati di pagamento: solo importi e stato;
- note interne della produzione;
- costi AI.

## Ruoli ritirati (modalità HubSpot)

`NEXT_PUBLIC_CRM_MODE=hubspot` è il valore predefinito.

- **Ritirati** i modelli «Marketing» e «Admin con Marketing»: non si possono più assegnare, mentre chi li ha già li conserva. Il marketing lavora in HubSpot.
- **Restano** i commerciali e l'admin commerciale. In Proemios le proposte di editing, correzione e percorsi completi le prepara una persona, con prezzo di listino, contratto e «Accetta e paga». Diversamente da ProntoSito, dove i piani si comprano da soli, qui il commerciale serve ancora nella piattaforma per le proposte. Il resto del suo lavoro (contatti, chiamate, email, attività) passa in HubSpot.
- **Schede nascoste** nello spazio del team: Trattative, Clienti, Coda libera e Marketing. Restano Richieste, Preventivi, Eccezioni, Le mie vendite, Produzione, Studio e Cabina di regia.
- Nessuna tabella e nessun dato vengono cancellati. `NEXT_PUBLIC_CRM_MODE=platform` riporta tutto com'era.

## Configurazione

1. **Portale.** Usa il portale HubSpot di Proemios, **non Acathesis** (148973952). Prima di qualsiasi scrittura verifica il nome del portale in alto a destra.
2. **Pipeline.** Va bene quella predefinita (Sales Pipeline). Se ne crei una dedicata «Proemios», copia gli id di pipeline e fasi da Impostazioni → Oggetti → Trattative → Pipeline e impostali in `HUBSPOT_DEAL_PIPELINE`, `HUBSPOT_DEAL_STAGE_LEAD`, `_ACCEPTED` e `_WON`.
3. **App privata.** Impostazioni → Integrazioni → App private (o Development → Private apps) → Crea. Scope:
   - `crm.objects.contacts.read`, `crm.objects.contacts.write`;
   - `crm.objects.deals.read`, `crm.objects.deals.write`;
   - `crm.objects.line_items.read`, `crm.objects.line_items.write`;
   - `crm.objects.owners.read`;
   - `crm.schemas.contacts.read`, `crm.schemas.contacts.write`, `crm.schemas.deals.read`, `crm.schemas.deals.write`, che servono a creare le proprietà `proemios_*`;
   - attività (Tasks): lettura e scrittura, con lo scope che il portale mostra per gli oggetti «tasks».
4. **Variabili su Vercel** (Production; Sensitive per il token):
   - `HUBSPOT_ACCESS_TOKEN`;
   - `HUBSPOT_SALES_OWNER_EMAIL`, l'email HubSpot del responsabile commerciale;
   - `HUBSPOT_OPS_OWNER_EMAIL`, l'email HubSpot di Alberto.

   Il token non va mai in chat né nei file.
5. **Utenti HubSpot.** Commerciali e Alberto vanno invitati in HubSpot con la stessa email che usano in Proemios: così il responsabile si collega da solo.
6. **Verifica.** Impostazioni CRM → Diagnostica → «HubSpot (CRM commerciale)» passa a «Verificato» dopo la prima sincronizzazione riuscita. Un errore mostra il messaggio di HubSpot (ad esempio uno scope mancante).

**Primo avvio.** La sincronizzazione parte da «adesso»: le richieste di prova già nel database non finiscono in HubSpot. Per recuperare il passato imposta `HUBSPOT_SYNC_FROM` con una data ISO. In anteprima la sincronizzazione resta spenta salvo `HUBSPOT_SYNC_PREVIEW=1`, da usare solo con un portale di prova.

## Stato

| Voce | Stato |
|---|---|
| Client, sincronizzazione, idempotenza, collegamento della trattativa del commerciale, ritentativi in ordine, avvio da «adesso», spento in anteprima, orario di lavoro | verificato nei test locali con HubSpot simulato (`tests/hubspot-sync.test.ts`) |
| Ruoli ritirati e ritorno in modalità platform | verificato nei test locali (`tests/crm.integration.test.ts`) |
| HubSpot reale | **non verificato**: serve il token della app privata del portale Proemios |
| Tracciamento HubSpot sul sito, moduli HubSpot, Inbox e WhatsApp | non fatti. Il codice di tracciamento richiederebbe il consenso cookie e l'aggiornamento di privacy e cookie policy |
