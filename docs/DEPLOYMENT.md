# Rilascio

## Prerequisiti

Prima del primo deploy in produzione servono, e sono decisioni di persone, non
comandi:

- [ ] dominio `proemios.it` puntato a Vercel (mai `proemios.com`: è di terzi);
- [ ] database Neon in **regione UE**;
- [ ] bucket S3-compatibile in UE: accesso pubblico bloccato, cifratura a
      riposo, versioning attivo, credenziali con i soli permessi
      Get/Put/Head/Delete sul prefisso;
- [ ] dominio email verificato su Resend (SPF, DKIM, DMARC);
- [ ] account Stripe attivo, con il webhook configurato;
- [ ] DPA firmato con ogni sub-responsabile (vedi `PRIVACY.md`);
- [ ] policy privacy dei provider AI inserite in `provider_policies`: **senza,
      il router non seleziona nessun modello**, ed è il comportamento voluto.

## Variabili d'ambiente

`.env.example` le elenca tutte con il motivo di ognuna. Le obbligatorie in
produzione:

| Variabile                                    | Perché                                                                |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                               | Senza, il prodotto non parte                                          |
| `AUTH_SECRET`                                | Senza, i cookie di sessione non sono verificabili                     |
| `AUTH_URL`                                   | Costruisce i link di accesso                                          |
| `RESEND_API_KEY`, `AUTH_EMAIL_FROM`          | Senza, nessuno può entrare                                            |
| `S3_*`, `STORAGE_DRIVER=s3`                  | I manoscritti non stanno sul filesystem di un container effimero      |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Senza il secondo, chiunque potrebbe marcare un ordine come pagato     |
| `INNGEST_SIGNING_KEY`                        | Senza, chiunque potrebbe far partire l'elaborazione di un manoscritto |
| `DEMO_MODE=off`                              | **Obbligatoria.** Vedi sotto                                          |

`DEMO_MODE` va impostata esplicitamente a `off`. Il back-office accetta la demo
solo se richiesta con `on`: dedurla da una variabile mancante aprirebbe il
cruscotto a chiunque su un deploy mal configurato.

## Sequenza

```bash
# 1. Verifica completa, in locale o in CI
npm run typecheck && npx eslint . && npm run test
npm run db:up && npm run test:integrazione
npm run build && npm run test:e2e
node scripts/accessibilita.mjs

# 2. Migrazioni, prima del codice se additive
DATABASE_URL=<produzione> npm run db:migrate

# 3. Deploy
git push   # Vercel costruisce e promuove

# 4. Dopo il deploy
curl -sI https://proemios.it | grep -i content-security-policy
curl -s https://proemios.it/robots.txt
```

## L'ordine fra codice e migrazioni

**Migrazione additiva** (colonne o tabelle nuove): prima la migrazione, poi il
codice. Il codice vecchio ignora ciò che non conosce.

**Migrazione distruttiva** (cancella o rinomina): in **due rilasci**. Prima si
rilascia il codice che smette di usare la colonna; poi, in un rilascio separato,
la si toglie. Fatta in uno solo, fra il deploy del codice e quello dello schema
c'è una finestra in cui l'applicazione vecchia parla con lo schema nuovo.

## Il webhook Stripe

Endpoint: `https://proemios.it/api/webhooks/stripe`. Eventi da sottoscrivere:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

Il segreto del webhook è **diverso** da quello dell'API, ed è specifico
dell'endpoint: quello di prova non funziona in produzione.

## Inngest

`/api/inngest` va registrato nella dashboard di Inngest. `INNGEST_SIGNING_KEY`
verifica la firma delle richieste in arrivo: senza, chiunque conoscesse l'URL
potrebbe far partire l'elaborazione di un manoscritto.

## Primo accesso

`SEED_ADMIN_EMAIL` + `npm run db:seed` creano l'unico account che nasce senza
invito. Da lì si invitano le altre persone, e ogni invito lascia traccia di chi
ha invitato chi.

## Rollback

Vercel permette di promuovere un deploy precedente. Se il rilascio comprendeva
una migrazione additiva, tornare indietro col solo codice è sicuro. Se
comprendeva una distruttiva, non lo è — motivo per cui le distruttive si fanno
in due rilasci.

Per il database: `npm run db:rollback` applica `drizzle/down/<tag>.down.sql`.
**Fare un backup prima.** Un rollback di schema cancella dati.

## Dopo il go-live

Nella prima settimana vale la pena guardare ogni giorno:

- conversioni «non inviate» nel funnel;
- fatture in stato `errore`;
- Job in `failed`;
- notifiche con `erroreInvio` pieno;
- 429 nei log: se sono molti, o il limite è troppo stretto o c'è un abuso.
