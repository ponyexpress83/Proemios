# CRM: verifica iniziale, modello e scelta di isolamento

Questo documento precede ogni estensione del database del CRM, come richiesto. Descrive cosa esisteva il 17 ottobre 2026, il modello adottato, la scelta sull'isolamento tra aziende e il confine tra nucleo riutilizzabile e moduli editoriali.

## 1. Verifica iniziale (stato prima dell'intervento)

| Area | Stato | Dove |
|---|---|---|
| Richieste in ingresso (preventivo, contatto, agenzie, marketplace, import) | operativo | `lib/platform/public-forms.ts`, `crm.ts` |
| Contatto, richiesta e opportunità | **parziale**: un'unica riga `leads` fa da contatto, richiesta e trattativa. I moduli pubblici creano una riga nuova a ogni invio, anche con la stessa email | `db/schema.ts` |
| Proprietà del contatto | operativo: `platform_lead_ownership` (autore collegato + responsabile) | `access.ts` |
| Assegnazione automatica | **parziale**: solo venditori attivi e verificati, bilanciati per carico. Nessuna competenza, lingua, orario, assenza, capacità o coda monitorata | `inbound-routing.ts` |
| Coda a scelta libera, SLA, escalation | assente | |
| Attività, note | operativo; nessuna nota privata | `crm.ts` |
| Proposte con versioni, stati commerciali, sconti a soglia, rate | operativo | `crm.ts`, `commercial.ts`, `payments.ts` |
| Link alla proposta | operativo per il collegamento all'account (48 ore / 30 giorni); nessuna vista prima dell'account, nessuna revoca | `crm.ts` |
| Contratto prima del pagamento | operativo | `contracts.ts` |
| Attribuzione | **parziale**: `acceptedSellerId` e `salesAssisted` sulla proposta, affiliato per codice. Nessuna prova, nessuna regola versionata, nessun conflitto segnalato, nessuna correzione autorizzata | `crm.ts`, `payments.ts` |
| Provvigioni | operativo su incasso, con storni; nessuna separazione tra previsto, maturato e liquidato in un unico prospetto | `payments.ts` |
| Ordine → progetto | operativo: un progetto per proposta (vincolo unico), creato con l'acconto verificato. Nessun pacchetto di passaggio, nessuno stato operativo | `payments.ts` |
| Assegnazione operativa | **parziale**: membri del progetto scelti a mano | `projects.ts` |
| Compiti | operativo e minimo (titolo, scadenza, fatto) | `projects.ts` |
| Notifiche | operativo (interne + email in coda); non configurabili per persona | `operations.ts`, `mail.ts` |
| Bacheche | assenti (solo elenchi per area) | `workspace.tsx` |
| Integrazioni | Stripe e Fatture in Cloud operativi; Brevo e Analytics predisposti; nessuna API pubblica | `integrations.ts` |
| Ruoli | owner, admin (permessi espliciti), author, editor, coordinator, seller, affiliate, finance, marketing; nessuno può delegare oltre i propri permessi | `permissions.ts`, `team.ts` |

Simulato nei test: Stripe, Fatture in Cloud, posta (cartella temporanea), file (cartella temporanea). Nessun servizio esterno viene chiamato.

## 2. Modello adottato

```
Azienda (facoltativa) ─┐
                       Contatto ──< Richiesta (lead) ── fonte, data, stato, priorità, responsabile, prossima azione
                          │
                          └──< Trattativa (deal) ──< Proposta ──< Versioni
                                   │                    │
                                   │                    ├── Contratto (scheda + condizioni)
                                   │                    ├── Ordini e rate ── Incassi ── Provvigioni
                                   │                    └── Attribuzione (istantanea alla vendita, versionata)
                                   └── Progetto ── Passaggio operativo ── Fasi/compiti ── Consegne
Campagne, fonti, partner e affiliati alimentano Richiesta e Attribuzione.
```

- **Contatto** (`crm_contacts`): la persona. Uno solo per email normalizzata; una nuova richiesta con la stessa email si aggancia al contatto esistente e non ne crea un altro. Il collegamento a un account avviene solo con email verificata.
- **Richiesta** (`leads`, tabella esistente): ogni ingresso, con fonte e dettagli. Resta il punto di accesso per i permessi del venditore (`platform_lead_ownership`).
- **Trattativa** (`crm_deals`): l'opportunità. Un contatto ne ha molte; una trattativa ha molte proposte, e ciascuna ha le sue versioni. Lo stato è calcolato come nella pipeline esistente: gli stati derivati vengono dai fatti, «acquisto concluso» solo da un incasso verificato.
- **Azienda** (`crm_companies`): facoltativa.

Le righe esistenti vengono collegate dalla migrazione: un contatto per email, una trattativa per ogni richiesta esistente, le proposte agganciate alla trattativa della loro richiesta.

## 3. Isolamento tra aziende: scelta

**Scelta: un'azienda per installazione (single-tenant).** Una installazione corrisponde a un database, a uno spazio di archiviazione e a un insieme di credenziali. Il prodotto **non** è pronto per ospitare più aziende nello stesso database e non va presentato così.

Distinzioni che il codice rispetta già da ora:

| Concetto | Significato | Dove vive oggi |
|---|---|---|
| Tenant | l'azienda che usa il CRM e ne possiede i dati | l'installazione intera |
| Team | gruppo di persone dentro il tenant (vendite, marketing, produzione) | `team_profiles.team` |
| Marchio (brand) | come il tenant si presenta ai clienti; un tenant può averne più d'uno | impostazione `brand` |
| Cliente finale | contatto o autore del tenant | `crm_contacts`, account autore |

Un marchio non è un tenant: cambiare marchio non separa dati, permessi o credenziali.

Perché non una colonna `tenant_id` adesso. Una colonna da sola non isola. L'isolamento vero deve valere in ogni punto:

1. **query**: ogni lettura e scrittura filtrata per tenant, con Row Level Security di Postgres come seconda barriera;
2. **file**: prefisso di archiviazione per tenant e controllo del prefisso a ogni lettura;
3. **cache**: chiavi con il tenant;
4. **lavori asincroni**: il tenant nel payload di ogni lavoro (outbox, fatture, recuperi, webhook), verificato quando il lavoro riparte;
5. **export**: filtrati per tenant;
6. **credenziali di integrazione**: una cassaforte per tenant (Stripe, Fatture in Cloud, Resend, Brevo), mai condivise.

Farlo a metà darebbe una falsa sicurezza. Il percorso previsto è nella sezione 6. Finché quei punti non sono implementati e coperti da test di isolamento (un tenant che prova a leggere dati, file, export e lavori di un altro), il prodotto resta single-tenant.

## 4. Nucleo riutilizzabile e moduli editoriali

| Nucleo (`lib/crm-core/`, senza dipendenze dal dominio editoriale) | Moduli editoriali (`lib/platform/`) |
|---|---|
| Orari di servizio e SLA (`hours.ts`) | Listino, calcolo prezzi, pacchetti (`config/pricing.ts`, `lib/pricing.ts`) |
| Scelta dell'assegnatario (`assignment.ts`) | Manoscritti, analisi, file di lavorazione |
| Decisione di attribuzione (`attribution.ts`) | Fasi editoriali, approvazioni dell'autore |
| Deduplicazione (`dedup.ts`) | Scheda d'ordine e testi contrattuali |
| Pipeline, campi personalizzati, regole versionate (`pipelines.ts`, `fields.ts`, `rules.ts`) | Fatture in Cloud, Stripe Checkout |
| Firma dei webhook e ritentativi (`webhooks.ts`) | |

Il nucleo è fatto di funzioni pure, verificate da test unitari senza database (`tests/crm-core.test.ts`). I moduli in `lib/platform/crm-*.ts` le usano con il database: `crm-relations` (contatto, richiesta, trattativa, eventi), `crm-routing` (instradamento, coda, scadenze), `crm-contacts`, `crm-deals`, `crm-team`, `crm-attribution`, `crm-quotes`, `crm-handoff`, `crm-work`, `crm-config`, `crm-notify`, `crm-api`. Nomi, catalogo, pipeline, ruoli, campi, modelli e regole stanno in impostazioni, non nel codice. Il testo delle email esistenti contiene ancora il nome del marchio. Va portato sull'impostazione `brand` quando si estrae il prodotto (sezione 6).

## 5. Interfacce di integrazione

- API versionata `/api/v1` con chiavi a scopo limitato, conservate solo come impronta, mostrate una volta, revocabili, con limite di richieste per chiave e chiave di idempotenza obbligatoria sulle scritture. Descrizione in `/api/v1/openapi.json`.
- Moduli di acquisizione: chiave pubblica di modulo con il solo scopo `capture`, limitata alle origini dichiarate. Le chiavi privilegiate non vanno mai nel frontend.
- Webhook in uscita firmati (HMAC-SHA256 su `timestamp.corpo`), con id evento stabile per l'idempotenza, ritentativi con attesa crescente e registro delle consegne.
- Eventi stabili: `lead.created`, `lead.assigned`, `deal.stage_changed`, `quote.accepted`, `payment.confirmed`, `project.handoff_ready`.

Dettagli in `docs/CRM_INTEGRAZIONI_API.md`.

## 6. Percorso verso un CRM rivendibile (non implementato ora)

1. Spostare testi e nomi delle email sull'impostazione `brand`; catalogo dei servizi come impostazione.
2. Introdurre `tenant_id` su tutte le tabelle con RLS, prefissi di archiviazione, chiavi di cache, payload dei lavori e cassaforte delle credenziali per tenant. Test di isolamento su query, file, export, lavori e credenziali.
3. Estrarre `lib/crm-core` in un pacchetto separato con le sue migrazioni.
4. Solo dopo: licenze, fatturazione SaaS e marketplace di estensioni. Oggi esistono solo i punti di estensione: impostazioni versionate, campi personalizzati, webhook, API.
