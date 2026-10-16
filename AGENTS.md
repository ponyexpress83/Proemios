# Guida per chi lavora sul codice (persone e agenti)

Proemios è un'app Next.js 15 (App Router, React 19, TypeScript) con Postgres via Drizzle, Better Auth, Stripe Checkout + webhook, Resend (outbox), Fatture in Cloud, Vercel Blob, pdf-lib. Questo file dice dove stanno le cose, quali regole non si toccano e come si verifica.

## Comandi

- `npm ci` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`
- Test di integrazione (`tests/platform.integration.test.ts`): PGlite in memoria, migrazioni SQL di `drizzle/` applicate in ordine, posta e file in cartelle temporanee. Nessun servizio esterno viene chiamato: Stripe e Fatture in Cloud sono simulati.
- Migrazioni: modificare `db/schema.ts` o `db/platform-schema.ts`, poi `DATABASE_URL=postgresql://x@localhost/x npx drizzle-kit generate --name <nome>`; mai `db:push` su dati reali.

## Mappa

| Area | File |
|---|---|
| Listino e calcolo prezzi | `config/pricing.ts`, `lib/pricing.ts` (unica fonte dei prezzi; nessun prezzo dal browser) |
| Stati commerciali, regola di acquistabilità, soglie sconto/rate | `lib/platform/commercial.ts` |
| Pipeline CRM (stati derivati + manuali) | `lib/platform/pipeline.ts`, `lib/platform/crm.ts` |
| Contratto (scheda d'ordine, condizioni versionate, PDF, recesso) | `lib/platform/contracts.ts`, `config/contract-terms.ts`, `lib/platform/pdf.ts` |
| Pagamenti, piano rate, rimborsi, webhook Stripe, creazione progetto | `lib/platform/payments.ts`, `lib/platform/schedule.ts`, `app/api/webhooks/stripe/route.ts` |
| Progetti e fasi | `lib/platform/projects.ts` |
| Promemoria e recuperi | `lib/platform/reminders.ts`, `lib/platform/recovery.ts` |
| Marketing (campagne, spesa, contatti, dashboard, bozze automazioni) | `lib/platform/marketing.ts`, `lib/platform/integrations.ts` |
| Attribuzione di sessione | `lib/attribution.ts`, `lib/attribution-client.ts`, `components/marketing/session-attribution.tsx` |
| Analytics con consenso | `lib/analytics.ts`, `components/marketing/analytics.tsx` |
| Brevo (predisposto) | `lib/platform/brevo.ts`, `app/api/webhooks/brevo/route.ts` |
| Permessi e ruoli | `lib/platform/permissions.ts`, `lib/platform/access.ts`, `lib/platform/realms.ts` |
| Router della piattaforma | `app/api/platform/[...path]/route.ts` |
| Interfacce | `components/platform/workspace.tsx` (team), `components/author/*` (autori) |
| Documentazione operativa | `docs/*.md`, in particolare `docs/CONSEGNA_2026-10-16.md` |

## Regole che non si cambiano senza autorizzazione

- Prezzi e `DEPOSIT_RATE` (`config/pricing.ts`): nessuna modifica senza autorizzazione esplicita del proprietario. Gli sconti esistono solo entro le soglie della regola `purchase-rule`.
- Ogni autorizzazione è server-side: i permessi si controllano nel router/moduli con `demand`/`can`; nascondere un pulsante non autorizza niente.
- Il pagamento è confermato solo dal webhook Stripe firmato; mai dal ritorno del browser. Il progetto nasce solo con l'acconto verificato.
- Il contratto (scheda d'ordine + condizioni versionate) precede il pagamento; i testi legali nuovi restano in bozza (`docs/`) finché non vengono approvati.
- Nessuna email reale nei test, nessuna fattura reale, nessun invio su WhatsApp/SMS simulato: le attività su quei canali sono manuali e registrate.
- Nessun dato personale negli URL, nei link tracciati o negli eventi analytics; niente manoscritti o testi liberi verso strumenti pubblicitari.
- Niente nuove integrazioni LLM per funzioni che bastano regole deterministiche.
- Nessun token hardcoded; le credenziali stanno solo nelle variabili d'ambiente e l'interfaccia mostra solo "configurato / da collegare".

## Convenzioni

- Un modulo = un dominio; le funzioni handler hanno firma `(request, actor, id?)` e usano `readBody` con schemi zod `strict()`.
- Transazioni: dentro `getDb().transaction` usare solo `tx` (una sola connessione in test).
- Idempotenza: chiavi evento (`eventKey`) per outbox, registro e attività; `onConflictDoNothing` per i doppioni.
- Documentare in `docs/` ogni comportamento nuovo e distinguere sempre: scritto nel codice · verificato in test · attivo in produzione.
