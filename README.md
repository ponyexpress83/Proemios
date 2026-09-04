# Proemios

Piattaforma italiana di servizi editoriali assistiti dalla tecnologia — _dall'idea al
libro pubblicato_. Payoff: **Dalle idee alle opere**.

> Dominio canonico: **proemios.it** (il `.com` è di terzi: nessun URL punta lì).

Questo repository contiene la **Fase 1**: generare e chiudere lead (configuratore di
preventivo, analisi manoscritto, pagine servizio). Le Fasi 2-3 (account, dashboard di
progetto, abbonamenti AI, portale white label) sono documentate in `db/schema.ts` e in
`config/plans.ts` per garantire estendibilità senza refactor, **ma non sono implementate**.

## Stack

- **Next.js 15** (App Router), **TypeScript strict**, React 19
- **Tailwind CSS 4**
- **Drizzle ORM** + **Neon Postgres** (driver serverless)
- **Stripe** (Fase 1: solo Checkout `payment`, acconti)
- **Resend** (email transazionali)
- **Anthropic API** (analisi manoscritto)
- **Zod** su ogni confine · **Vitest** per i test

## Struttura

```
app/           route App Router, API route, robots/sitemap/OG, middleware admin
components/
  ui/          primitivi del design system (Gabbia, Versale, Filetto, NotaMargine…)
  layout/      testata, colophon, marchio
  sezioni/     blocchi condivisi (processo, FAQ, chiusa, documento legale)
  preventivo/  configuratore multi-step + risultato
  analisi/     caricamento manoscritto + report
  moduli/      form (contatto, agenzie, piani AI)
config/        costanti di business: brand, servizi, prezzi, piani AI, copy ← unica fonte di verità
content/blog/  12 articoli MDX (frontmatter + outline di lavoro)
lib/           logica di dominio: pricing (puro, testato), metrics, ai, email, stripe, seo, blog
db/            schema Drizzle + migration + seed
tests/         Vitest: pricing engine + parsing risposta AI + metriche
DESIGN_PLAN.md piano di design (implementato)
```

Il **brand è sostituibile** modificando `config/brand.ts`. Le tariffe vivono in
`config/pricing.ts`; la logica di calcolo (pura) in `lib/pricing.ts`.

## Setup

```bash
cp .env.example .env.local   # compila le variabili
npm install
npm run dev                  # http://localhost:3000
```

### Modalità demo (nessuna variabile richiesta)

Senza `DATABASE_URL` il sito entra automaticamente in **modalità demo**: si avvia,
si naviga per intero e si può mostrare a qualcuno senza configurare niente.

```bash
npm install
npm run build && npm start   # nessun .env.local
```

Cosa cambia:

|                     | In demo                                          | In esercizio                    |
| ------------------- | ------------------------------------------------ | ------------------------------- |
| Preventivo          | calcolato dal motore vero, tenuto in memoria     | salvato su Neon                 |
| Analisi manoscritto | metriche vere sul file, giudizio d'esempio       | giudizio del modello            |
| Acconto             | conferma simulata, nessun addebito               | Stripe Checkout                 |
| Email               | non inviate                                      | Resend                          |
| `/admin`            | aperto solo con `DEMO_MODE=on`, righe d'esempio | account staff con accesso via link email |
| Indicizzazione      | `robots.txt` chiuso, pagine `noindex`            | aperta                          |

Ogni schermata che simula qualcosa lo dichiara: fascia in testa al sito, avviso sul
report di analisi, avviso sulla pagina di conferma acconto. **Nessun dato inserito
viene salvato o inviato**: l'archivio è in memoria e sparisce al riavvio del processo.

Il comportamento si forza con `DEMO_MODE=on` (anche con database configurato) o si
esclude con `DEMO_MODE=off`. La logica sta in `lib/demo.ts`, con i test in
`tests/demo.test.ts`.

### Variabili d'ambiente

Tutte documentate in `.env.example`. In sintesi:

| Variabile                                                                          | Uso                                                  |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                             | URL canonico (https://proemios.it)                   |
| `DATABASE_URL`                                                                     | Neon Postgres (`?sslmode=require`)                   |
| `ANTHROPIC_API_KEY`                                                                | Analisi manoscritto                                  |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout acconti + webhook                           |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_INTERNAL`                                   | Email transazionali e notifiche interne              |
| `AUTH_SECRET`, `AUTH_URL`, `AUTH_EMAIL_FROM`                                       | accesso all'area riservata (Auth.js + Resend)        |
| `NEXT_PUBLIC_CALENDAR_URL`                                                         | Embed calendario in `/contatti`                      |
| `NEXT_PUBLIC_ANALYTICS_DOMAIN`                                                     | Analytics cookieless (opzionale)                     |
| `MANUSCRIPT_RETENTION_DAYS`                                                        | Giorni prima della cancellazione delle analisi       |
| `DEMO_MODE`                                                                        | `on`/`off` per forzare la modalità demo (vedi sotto) |

## Comandi

```bash
npm run dev        # sviluppo
npm run build      # build di produzione
npm run typecheck  # tsc --noEmit
npm run test       # Vitest (pricing, parsing AI, metriche)
npx eslint .       # lint
npx prettier --write .  # formattazione
npm run db:generate  # genera la migration dallo schema
npm run db:migrate   # applica le migration su Neon
npm run db:push      # push diretto dello schema (dev)
npm run db:seed      # popola dati di esempio per l'admin
```

### Database (Neon)

1. Crea un progetto su [neon.tech](https://neon.tech) e copia la connection string in
   `DATABASE_URL`.
2. Applica lo schema: `npm run db:migrate` (oppure `npm run db:push` in dev).
3. Popola i dati di esempio: `npm run db:seed`.

### Webhook Stripe in locale

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# copia il whsec_... in STRIPE_WEBHOOK_SECRET
```

## Deploy (Vercel)

**Per una demo**: importa il repo e fai deploy **senza impostare nulla**. Parte in
modalità demo, resta fuori dall'indice dei motori e usa il dominio assegnato da Vercel
come canonico (`NEXT_PUBLIC_VERCEL_URL`), senza rivendicare quello di produzione.

**Per la produzione**:

1. Importa il repo su Vercel.
2. Imposta tutte le env var (le stesse di `.env.example`; `NEXT_PUBLIC_SITE_URL` =
   URL di produzione). Con `DATABASE_URL` impostata la modalità demo si spegne da sola.
3. Configura il webhook Stripe verso `https://<dominio>/api/webhooks/stripe`.
4. Deploy automatico ad ogni push.

## Comunicazione sull'AI (vincolo)

Ovunque la tecnologia interviene si usa la formula di `config/brand.ts`
(`aiDisclaimer`): _"Processo editoriale assistito dalla tecnologia e sottoposto a
controllo professionale: ogni consegna viene verificata e approvata da un
professionista."_ Mai dichiarare processi "100% umani". Nel tool di analisi il report è
dichiarato come prima diagnosi automatica.

## Cosa c'è (Fase 1 completa)

| Area                                                                                          | Stato |
| --------------------------------------------------------------------------------------------- | ----- |
| Design system editoriale (gabbia, versali, filetti, folî, colophon)                           | ✅    |
| Homepage e pagine servizio (6 pacchetti, generate da `config/services.ts`)                    | ✅    |
| Landing: dal-diario-al-libro, libro-per-professionisti, per-agenzie                           | ✅    |
| Configuratore preventivo (6 passi, anteprima live, tre pacchetti)                             | ✅    |
| Analisi manoscritto (docx/pdf/txt, metriche locali + giudizio AI, rate limit)                 | ✅    |
| Strumenti AI: piani mensile/annuale + lista d'attesa                                          | ✅    |
| Stripe Checkout acconto 40% + webhook firmato                                                 | ✅    |
| Email transazionali (Resend) + notifiche interne                                              | ✅    |
| Area riservata con accesso via link email, ruoli e permessi server-side                      | ✅    |
| Blog MDX (12 outline), casi studio, chi siamo, contatti                                       | ✅    |
| Legali: privacy, termini, cookie (testo completo, anagrafica in `config/legal.ts`)            | ✅    |
| Modalità demo integrale senza variabili d'ambiente                                            | ✅    |
| SEO: metadata, JSON-LD (Organization/Service/FAQPage/Article/Breadcrumb), sitemap, robots, OG | ✅    |

Verifiche: `next build` verde (52 pagine), `tsc --noEmit` pulito, **48 test Vitest**,
ESLint senza errori, nessun `any`, nessun overflow orizzontale su mobile.

## Prima della messa online

Il sito funziona anche senza segreti (le funzioni degradano con un messaggio chiaro),
ma per la produzione servono:

1. **Segreti**: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `STRIPE_*`, `RESEND_API_KEY`,
   `AUTH_SECRET`, `NEXT_PUBLIC_CALENDAR_URL`.
2. **Database**: `npm run db:migrate` su Neon.
3. **Pagine legali**: il testo è completo e l'anagrafica del titolare
   (Smart Content S.r.l.s.) è compilata in `config/legal.ts` sulla base della visura
   camerale. Verificare su visura aggiornata che sede, PEC e amministratori non siano
   cambiati, e far validare i documenti a un professionista.
4. **Casi studio**: `config/case-studies.ts` — confermare con i clienti la pubblicazione
   dei due casi reali; il terzo è marcato `autorizzato: false` perché dimostrativo.
5. **Blog**: gli articoli sono outline (`pubblicato: false`, quindi `noindex`).
   Scriverli e portare il flag a `true` con la data.

## Fase 2 (non implementata)

Account con magic link, dashboard di progetto, abbonamenti Stripe attivi
(`SUBSCRIPTIONS_LIVE` in `config/plans.ts`), generatore di copertine, ottimizzatore
scheda Amazon, portale white label. Lo schema in `db/schema.ts` documenta le entità
future (`users`, `organizations`, `subscriptions`, `projects`, `project_stages`,
`deliverables`) perché arrivino senza migrazioni distruttive.
