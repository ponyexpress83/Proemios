# CRM: collaudo su un ambiente di prova

Come verificare gli scenari A–F della messa in uso su un'**anteprima** Vercel (mai sul sito pubblico), con account di prova, contatti sintetici e pagamenti Stripe in **modalità test**.

## 1. Prerequisiti dell'anteprima

| Cosa | Dove | Come si controlla |
|---|---|---|
| Database dell'anteprima **separato** da quello di produzione | Vercel → Settings → Environment Variables, `DATABASE_URL` con ambito *Preview* | host o nome del database diversi da quelli di *Production* |
| Migrazioni `0012` e `0013` applicate | una volta sola, scegliendo una strada: <br>• `RUN_MIGRATIONS_ON_PREVIEW=1` con ambito *Preview*, poi un nuovo deploy dell'anteprima (lo script `vercel-build` migra solo in anteprima e solo se la variabile è attiva; in produzione si rifiuta) <br>• oppure `npm run db:migrate` da un terminale con il `DATABASE_URL` dell'anteprima | Impostazioni CRM → Diagnostica → «Database e migrazioni» |
| `CRON_SECRET` | variabili *Preview* | Diagnostica → cron |
| Stripe **test**: `STRIPE_SECRET_KEY` (`sk_test_…`) e `STRIPE_WEBHOOK_SECRET` dell'endpoint `https://<anteprima>/api/webhooks/stripe` registrato in modalità test | Stripe Dashboard (Test mode) → Developers → Webhooks; variabili *Preview* | Diagnostica → «Pagamenti»: «Modalità test» |
| Email: Resend con mittente verificato, oppure account di prova su caselle che controlli | variabili *Preview* | Diagnostica → «Email operative» |
| Protezione dell'anteprima | se attiva, un token «Protection Bypass for Automation» | — |

Dopo ogni modifica alle variabili serve un nuovo deploy dell'anteprima: Vercel → Deployments → Redeploy. Lo script `vercel-build` viene usato solo se nelle impostazioni del progetto non c'è un «Build Command» personalizzato.

## 2. Account di prova

Servono sei account creati **sull'anteprima** con caselle di prova:

| Chiave | Ruolo | Come si crea |
|---|---|---|
| `owner` | proprietario (l'indirizzo in `PROEMIOS_OWNER_EMAIL` dell'anteprima) | registrazione, verifica dell'email, verifica in due passaggi |
| `sellerA`, `sellerB` | venditore | invito da **Team e carichi** con il modello «Venditore»; lingue `it`, capacità indicata |
| `operator` | operatore di produzione | invito con il modello «Operatore di produzione», competenza `editing` |
| `clientB`, `clientC` | clienti (autori) | registrazione dal sito con email verificata |

Per lo staff serve la verifica in due passaggi: nel file degli account si mette l'URI `otpauth://…` (o il segreto base32) mostrato quando la si attiva. Il file resta sul computer di chi collauda e **non** va nel repository (`.gitignore` copre `collaudo-account*.json`):

```json
{
  "owner":    { "email": "…", "password": "…", "totp": "otpauth://totp/…" },
  "sellerA":  { "email": "…", "password": "…", "totp": "otpauth://totp/…" },
  "sellerB":  { "email": "…", "password": "…", "totp": "otpauth://totp/…" },
  "operator": { "email": "…", "password": "…", "totp": "otpauth://totp/…" },
  "clientB":  { "email": "…", "password": "…" },
  "clientC":  { "email": "…", "password": "…" }
}
```

Lo scenario D usa le assenze temporanee dei due venditori di prova. Se nell'anteprima altre persone ricevono richieste, D non viene eseguito.

## 3. Esecuzione con lo script

```bash
export COLLAUDO_URL=https://<anteprima>.vercel.app
export COLLAUDO_ACCOUNTS=./collaudo-account.json
export COLLAUDO_CRON_SECRET=<CRON_SECRET dell'anteprima>      # per D ed F
export VERCEL_PROTECTION_BYPASS=<token>                        # solo se l'anteprima è protetta
node scripts/collaudo-crm.mjs avvia
```

`avvia` esegue nell'ordine:
- 0: controlli dell'ambiente, con arresto se Stripe non è in modalità test;
- A: richiesta da campagna;
- D: coda e assegnazione successiva;
- B: proposta, link e accettazione;
- C: link a pacchetto e acquisto;
- F: due chiamate a ciascun cron.

Per B e C stampa il link del checkout Stripe. Si paga l'acconto con la carta di prova `4242 4242 4242 4242`, una data futura e un CVC qualsiasi. Poi:

1. Nella Dashboard Stripe (Test mode) → Events, apri l'evento `checkout.session.completed` di uno dei due pagamenti e premi **Resend**: serve a provare il webhook duplicato.
2. Esegui `node scripts/collaudo-crm.mjs dopo-pagamento`.

`dopo-pagamento` verifica:
- B: un solo progetto, attribuzione e passaggio alla produzione;
- C: attribuzione al venditore del link;
- E: l'operatore vede solo il progetto assegnato e il cliente vede l'avanzamento;
- F: nessun progetto, attribuzione o provvigione doppia.

Lo script scrive in `collaudo-crm-stato.json` l'esito di ogni passo: verificato o non verificato, con il motivo.

## 4. Senza terminale: gli stessi controlli dall'interfaccia

| Scenario | Passi | Esito atteso |
|---|---|---|
| A | dal sito, richiedi un preventivo con un'email di prova e `?utm_source=collaudo&utm_campaign=prova` nell'indirizzo | in **Richieste** ha un responsabile; il venditore ha la notifica; registra un'attività email |
| D | in **Team e carichi** aggiungi un'assenza di un'ora ai due venditori di prova; nuova richiesta dal sito | richiesta «in coda» con avviso al proprietario; togli le assenze; dopo il cron frequente ha un responsabile |
| B | come venditore A, nuova trattativa per il cliente B → proposta → link; come cliente B apri il link, collega, accetta, paga con la carta di prova | un solo progetto; **Impostazioni CRM**/attribuzione al venditore A; passaggio alla produzione presente |
| C | come venditore B, link a pacchetto per il cliente C; il cliente C compra e paga | attribuzione «link a pacchetto» al venditore B |
| E | come cliente B carica un file nel progetto; come proprietario crea una fase e assegnala all'operatore | l'operatore vede solo quel progetto; il cliente vede lo stato aggiornato |
| F | Stripe → Resend dell'evento; chiama due volte i cron con il segreto | un solo progetto e una sola provvigione; **Attività automatiche** mostra il secondo giornaliero come «saltato» |

## 5. Verificato in locale

Il 17/10/2026 lo script ha completato tutti i passi (0, A, D, B, C, F, E e i doppioni) contro un server locale con Postgres, account di prova con verifica in due passaggi e pagamenti simulati con eventi firmati. Nella simulazione locale ogni evento è stato inviato tre volte. Sull'anteprima non è ancora stato eseguito.
