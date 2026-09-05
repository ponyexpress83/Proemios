# Operazioni

## Ambienti

|             | Sviluppo                          | Anteprima                          | Produzione       |
| ----------- | --------------------------------- | ---------------------------------- | ---------------- |
| Database    | Postgres locale (`npm run db:up`) | Ramo Neon                          | Neon, regione UE |
| Storage     | filesystem (`.storage/`)          | S3 di prova                        | S3 UE            |
| `DEMO_MODE` | vuota                             | `on`                               | **`off`**        |
| Modelli AI  | provider finti nei test           | chiavi di prova                    | chiavi vere      |
| Robots      | —                                 | `Disallow: /` (automatico in demo) | indicizzato      |

## Avvio locale

```bash
cp .env.example .env.local     # e riempi ciò che serve
npm ci
npm run db:up                  # Postgres su :5433
npm run db:migrate
npm run db:seed                # crea il primo amministratore da SEED_ADMIN_EMAIL
npm run dev
```

I lavori in background hanno bisogno di `npx inngest-cli dev` in un secondo
terminale. Senza, le elaborazioni restano in coda: è visibile, non silenzioso.

## Verifica prima di rilasciare

```bash
npm run typecheck
npx eslint .
npm run test                   # unitari
npm run db:up && npm run test:integrazione   # su Postgres vero
npm run build
npm run test:e2e               # su un'app costruita
node scripts/accessibilita.mjs # WCAG 2.1 A/AA, zero violazioni
npm run docx:verifica          # i DOCX si aprono con LibreOffice
npm run verifica:csp           # la CSP non rompe le pagine
```

## Migrazioni

```bash
npm run db:generate            # dopo aver cambiato db/schema/
npm run db:genera-rollback <tag>   # scrive drizzle/down/<tag>.down.sql
npm run db:migrate
```

**Ogni migrazione ha il suo rollback**, e il rollback va provato: applicare,
disapplicare, riapplicare su un database di test. Un rollback mai eseguito è un
file di testo, non una via d'uscita.

Le migrazioni che aggiungono colonne o tabelle sono sicure. Quelle che
cancellano o rinominano vanno fatte in due rilasci: prima si smette di usare la
colonna, poi la si toglie. Altrimenti fra il deploy del codice e quello dello
schema c'è una finestra in cui l'applicazione vecchia parla con lo schema nuovo.

## Lavori periodici

| Lavoro                     | Quando      | Perché                                                      |
| -------------------------- | ----------- | ----------------------------------------------------------- |
| `consegnaConversioni()`    | ogni ora    | Carica le conversioni offline su Google Ads                 |
| `ripulisci()` (limitatore) | ogni giorno | Le finestre vecchie non servono e sono un dato da custodire |
| Cancellazione estratti     | ogni giorno | `MANUSCRIPT_RETENTION_DAYS`                                 |

## Quando qualcosa va storto

**Un Job resta in `running`.** Guarda `ai_job_runs`: se l'ultima run è in errore,
il messaggio è sanitizzato e dice il tipo di problema. I job Inngest hanno
`onFailure`: un fallimento porta il Job in `failed`, da cui si può ritentare.
Un Job che resta in `running` senza run in corso è un worker morto a metà — si
rimette in `queued`.

**Il webhook Stripe risponde 500.** Stripe riprova da solo, e le operazioni sono
idempotenti: due consegne dello stesso evento non producono due incassi. Guarda i
log per `webhook.ordine-errore` prima di rispondere manualmente.

**Una fattura è in `errore`.** Il messaggio del provider è nella riga. Un errore
sui dati (partita IVA sbagliata, indirizzo incompleto) si risolve
nell'anagrafica del cliente e poi si riprova; uno di rete torna da solo in
`da_emettere`.

**Le conversioni non arrivano su Google Ads.** Il funnel le mostra come «non
inviate». Cause tipiche, in ordine di frequenza: credenziali mancanti, nessuna
azione di conversione mappata in `GOOGLE_ADS_AZIONI`, conversioni senza `gclid`
(non attribuibili, e non si mandano di proposito).

**Un cliente dice che non riceve le email.** Guarda `notifications`: se
`erroreInvio` è pieno, il problema è Resend o il dominio non verificato. Se
`inviataAt` è pieno, l'email è partita e il problema è a valle.

**«Non riesco più a entrare».** Controlla che l'account sia attivo e che la
sessione non sia stata revocata. Le sessioni sono in database: revocarle è
immediato, e riattivare un account non ne resuscita nessuna.

## Rollback di un rilascio

Vercel permette di promuovere un deploy precedente. Attenzione all'ordine: se il
rilascio comprendeva una migrazione **additiva**, tornare indietro col solo
codice è sicuro. Se comprendeva una migrazione distruttiva, il codice vecchio
non troverà più ciò che gli serve — motivo per cui le migrazioni distruttive si
fanno in due rilasci.

## Cosa non si fa mai

- Mandare email vere da un ambiente di prova.
- Consegnare a un cliente un documento non passato dalla doppia approvazione.
- Cambiare i prezzi senza autorizzazione: `config/pricing.ts` è la fonte di
  verità, e un test verifica che nessun prezzo esista fuori da lì.
- Eseguire un rollback in produzione senza backup.
- Disattivare un test per far passare la pipeline.
