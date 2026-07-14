# Kalamos Studio — Fase 1

Sito e piattaforma di **Kalamos Studio**, service editoriale italiano assistito dalla
tecnologia per self-publisher, professionisti e agenzie. Non è un semplice sito
vetrina: include un **configuratore di preventivi** con prezzo istantaneo, un
**tool di analisi manoscritto AI** come lead magnet e **checkout Stripe** per gli
acconti.

> _Dal greco κάλαμος, la canna con cui gli antichi scrivevano: heritage classico +
> tecnologia contemporanea._

## Stack

- **Next.js 16** (App Router, React Server Components) · **TypeScript strict**
- **Tailwind CSS 4** (config CSS-first, componenti custom leggeri)
- **Drizzle ORM** + **Neon Postgres** (driver serverless)
- **Stripe Checkout** (modalità `payment`, nessun abbonamento in Fase 1)
- **Resend** per le email transazionali
- **Anthropic API** (`claude-sonnet-4-6`) per l'analisi manoscritto
- **Zod** per la validazione di form, API e webhook
- **Vitest** per i test unitari del motore di pricing

Nessuna autenticazione utente in Fase 1: lead e ordini vivono nel DB e si gestiscono
via email + un'unica pagina admin protetta da Basic Auth.

## Struttura

```
src/
  app/                    # App Router: pagine, API routes, sitemap, robots
    api/                  # preventivo, checkout, webhooks/stripe, analisi, contatto
    admin/                # dashboard interna (Basic Auth via middleware)
  components/             # UI, layout, sezioni, form, wizard preventivo, report analisi
  config/                 # services, pricing, blog, caseStudies, site (stringhe i18n-ready)
  db/                     # schema Drizzle + client Neon
  lib/                    # pricing (engine puro), analysis, extract, email, stripe, seo, ...
scripts/seed.ts           # seed di esempio (blog + lead/preventivi/analisi)
drizzle/                  # migration generate
```

Il **motore di pricing** (`src/lib/pricing.ts`) è una funzione pura e testabile: tutte
le tariffe sono in `src/config/pricing.ts`. Produce tre pacchetti (Essenziale /
Consigliato / Signature) con composizione e prezzo diversi.

## Setup

```bash
npm install
cp .env.example .env.local   # e compila i valori
```

### Variabili d'ambiente (vedi `.env.example`)

| Variabile | Descrizione |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL pubblico del sito |
| `DATABASE_URL` | Stringa di connessione Neon (pooled) |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chiavi Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret del webhook Stripe |
| `RESEND_API_KEY` | Chiave Resend |
| `EMAIL_FROM` / `EMAIL_INTERNAL_NOTIFY` | Mittente e destinatario notifiche interne |
| `ANTHROPIC_API_KEY` | Chiave Anthropic per l'analisi manoscritto |
| `ANTHROPIC_MODEL` | (opzionale) override del modello, default `claude-sonnet-4-6` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Credenziali Basic Auth per `/admin` |
| `NEXT_PUBLIC_CALENDLY_URL` | URL Calendly per l'embed contatti |
| `MANUSCRIPT_RETENTION_DAYS` | Giorni di conservazione dei file analizzati |

Il codice **degrada con eleganza** senza le chiavi: senza Resend le email vengono
loggate, senza Stripe il checkout risponde `503`, senza Anthropic l'analisi risponde
`503`. Il `build` e il `typecheck` non richiedono segreti reali.

## Comandi

```bash
npm run dev          # sviluppo
npm run build        # build di produzione
npm run start        # avvio produzione
npm run typecheck    # tsc --noEmit
npx eslint src       # lint (ESLint flat config)
npm run format       # Prettier
npm test             # Vitest (motore di pricing)
```

## Database (Drizzle + Neon)

Le migration sono già generate in `drizzle/`.

```bash
# Applica le migration al database Neon (usa DATABASE_URL)
npm run db:migrate

# In alternativa, sincronizza lo schema senza migration file (dev):
npm run db:push

# Rigenera le migration dopo aver modificato lo schema:
npm run db:generate

# Seed di esempio (12 post del blog + lead/preventivi/analisi dimostrativi):
npm run db:seed
```

Crea un progetto su [Neon](https://neon.tech), copia la connection string **pooled**
in `DATABASE_URL`, poi lancia `npm run db:migrate`.

## Stripe in locale (webhook)

Il webhook `/api/webhooks/stripe` marca l'ordine come `deposit_paid` e invia le email
di conferma. In locale usa la [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# 1. Login
stripe login

# 2. Inoltra gli eventi al webhook locale (stampa un whsec_...)
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# 3. Copia il secret stampato in STRIPE_WEBHOOK_SECRET (.env.local) e riavvia dev

# 4. (opzionale) simula un pagamento completato
stripe trigger checkout.session.completed
```

Il flusso completo del preventivo: configuratore → salvataggio lead+quote → email di
riepilogo → checkout dell'acconto (40%) → webhook → ordine `deposit_paid`.

## Deploy (Vercel)

- Importa il repo su Vercel e imposta le variabili d'ambiente del pannello.
- Aggiungi le migration al processo di build oppure lanciale una tantum con
  `npm run db:migrate` puntando a Neon.
- Configura l'endpoint del webhook Stripe di produzione su
  `https://<dominio>/api/webhooks/stripe` e imposta `STRIPE_WEBHOOK_SECRET`.

## Note su AI e comunicazione (vincolo legale)

In footer e nelle pagine dove l'AI è coinvolta compare la formula:

> _«Processo editoriale assistito dalla tecnologia e sottoposto a controllo
> professionale: ogni consegna viene verificata e approvata da un professionista.»_

Nel tool di analisi è esplicitato che il report è generato automaticamente ed è una
stima preliminare, poi verificata da un professionista.

## Fuori scope (Fase 1)

Niente area clienti con login, niente abbonamenti, niente marketplace di
professionisti, niente monitoraggio Amazon, niente servizi accademici, niente
versione inglese (le stringhe sono però centralizzate in `src/config/` per rendere
l'i18n aggiungibile senza refactor).
