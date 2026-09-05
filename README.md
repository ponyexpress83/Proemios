# Proemios

Piattaforma italiana di servizi editoriali assistiti dalla tecnologia — _dall'idea
al libro pubblicato_. Payoff: **Dalle idee alle opere**.

> Dominio canonico: **proemios.it**. Il `.com` è di terzi: nessun URL punta lì.

## Cos'è, davvero

Un cliente carica il manoscritto. Un motore lo segmenta e propone correzioni, che
**nessuno consegna finché una persona non le ha guardate una per una**. Il
redattore accetta, modifica o rifiuta; l'approvazione editoriale genera un file
Word con le revisioni tracciate — **il file del cliente**, non una ricostruzione —
e la consegna richiede l'approvazione di una seconda persona.

Attorno a questo: un CRM che misura il funnel reale, un piano di pagamento che
quadra al centesimo, fatture emesse da un provider fiscale, e un portale white
label per le agenzie.

## Le regole che il codice rende difficili da violare

- **L'AI non parla mai al cliente.** Ogni proposta passa da una persona.
- **Chi approva editorialmente non consegna.** La transizione non esiste nella
  macchina a stati, e chi ha approvato il contenuto non può approvare la
  consegna dello stesso lavoro nemmeno avendone il permesso.
- **L'originale non si tocca mai.** Ogni lavorazione è una versione nuova, e lo
  storage rifiuta la scrittura su una chiave già usata.
- **Nessun importo attraversa il browser.** Si passa l'id della rata; il prezzo
  lo dice l'ordine.
- **L'autorizzazione è lato server, sempre.** Nascondere un pulsante non è
  sicurezza.
- **I prezzi vengono da `config/pricing.ts`.** Un test verifica che non ne esista
  nessuno fuori di lì.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 ·
Drizzle ORM su PostgreSQL (node-postgres, servono le transazioni) · Auth.js v5
con sessioni su database · Inngest per i lavori durevoli · Stripe · Resend ·
Anthropic e OpenAI dietro un router · Zod su ogni confine · Vitest e Playwright.

## Struttura

```
app/
  (sito)/        sito pubblico: catalogo, percorsi, preventivo, blog
  area/          portale cliente: progetti, file, messaggi, pagamenti
  admin/         back-office: CRM, progetti, incassi, funnel, organizzazione
  redazione/     banco di revisione degli interventi
  api/           endpoint pubblici e webhook

lib/dati/        il livello dati: ogni funzione riceve un Attore per primo
lib/dto/         allowlist esplicite, una forma per ruolo
lib/auth/        ruoli, 53 permessi, guardie, sessione
lib/produzione/  segmentazione, ancoraggio, macchina a stati, motore
lib/docx/        OOXML: innesti su stringa, mai parse e riserializza
lib/ai/          router dei modelli, provider, limiti per livello di servizio
lib/commercio/   piano di pagamento (puro, in centesimi interi)
lib/analytics/   catalogo eventi, conversioni offline
lib/sicurezza/   CSP a nonce, intestazioni, limite di frequenza

db/schema/       Drizzle, 38 tabelle
config/          listino, catalogo, navigazione — fonte di verità dei prezzi
e2e/             Playwright su un'applicazione costruita
```

## Partire

```bash
cp .env.example .env.local
npm ci
npm run db:up        # Postgres locale su :5433
npm run db:migrate
npm run db:seed      # primo amministratore da SEED_ADMIN_EMAIL
npm run dev
```

Per i lavori in background serve `npx inngest-cli dev` in un secondo terminale.
Senza, le elaborazioni restano in coda — visibilmente, non in silenzio.

## Verificare

```bash
npm run typecheck && npx eslint .
npm run test                                  # unitari
npm run db:up && npm run test:integrazione    # su PostgreSQL vero
npm run build && npm run test:e2e             # su un'app costruita
node scripts/accessibilita.mjs                # WCAG 2.1 A/AA
npm run docx:verifica                         # i DOCX aperti da LibreOffice
npm run verifica:csp                          # la CSP non rompe le pagine
```

I test di integrazione non usano mock del database: un mock che accetta
qualunque query non può dimostrare che un tenant non veda i dati di un altro, ed
è esattamente ciò che devono dimostrare.

## Documentazione

|                                                                                                                         |                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                                               | Strati, scelte e perché               |
| [`DATA_MODEL.md`](docs/DATA_MODEL.md)                                                                                   | Le tabelle e i loro vincoli           |
| [`RBAC.md`](docs/RBAC.md)                                                                                               | Ruoli e permessi                      |
| [`AI_BACKOFFICE_ARCHITECTURE.md`](docs/AI_BACKOFFICE_ARCHITECTURE.md)                                                   | Pipeline editoriale e router          |
| [`DOCX_ENGINE.md`](docs/DOCX_ENGINE.md)                                                                                 | Revisioni tracciate senza ricostruire |
| [`COMMERCE.md`](docs/COMMERCE.md)                                                                                       | Ordini, incassi, fatture              |
| [`ANALYTICS.md`](docs/ANALYTICS.md)                                                                                     | Conversioni e white label             |
| [`SECURITY.md`](docs/SECURITY.md)                                                                                       | Confini, e come sono stati provati    |
| [`PRIVACY.md`](docs/PRIVACY.md)                                                                                         | Trattamento dei dati                  |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`ENVIRONMENT.md`](docs/ENVIRONMENT.md) · [`OPERATIONS.md`](docs/OPERATIONS.md) | Rilascio ed esercizio                 |
| [`LAUNCH_CHECKLIST.md`](docs/LAUNCH_CHECKLIST.md)                                                                       | Il cancello prima del go-live         |
| [`DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)                                                                             | Token e componenti                    |

## Stato

Le otto fasi di sviluppo sono complete e verificate. **Il go-live resta aperto**:
`LAUNCH_CHECKLIST.md` elenca ciò che manca, e le voci rimaste richiedono
credenziali, account esterni, decisioni legali o pagamenti reali — cose che il
codice non può chiudere da sé.
