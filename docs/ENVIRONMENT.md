# Variabili d'ambiente

La fonte di verità è `.env.example`, che le elenca tutte con il motivo di
ognuna. La validazione vive in `lib/env.ts` (Zod): una variabile mancante che
serve davvero fa fallire l'avvio con un messaggio che dice cosa manca, invece di
produrre un errore oscuro a runtime.

Questa pagina dice **cosa succede quando ne manca una**, che è la domanda che ci
si fa davvero.

## Sempre obbligatorie in produzione

| Variabile       | Se manca                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`  | L'applicazione non parte                                                                                                 |
| `AUTH_SECRET`   | I cookie di sessione non sono verificabili; in sviluppo Auth.js ne genera una effimera che invalida tutto a ogni riavvio |
| `DEMO_MODE=off` | Rischio di servire dati d'esempio in produzione                                                                          |

### Come Proemios capisce di essere il sito vero

Il cancello fail-closed in `lib/env.ts` rifiuta di avviare l'applicazione se
manca qualcosa di essenziale. Per farlo deve sapere se sta guardando la
produzione reale, e `NODE_ENV=production` **non lo dice**: lo usano anche le
preview di Vercel, la CI e ogni `next start` locale.

Nemmeno `DEMO_MODE=off` lo dice, ed è la confusione che costa di più: i test
end-to-end girano apposta con la demo spenta, perché devono esercitare i
percorsi reali — CSP, redirect delle aree riservate, limite di frequenza — e
non quelli simulati. Se il cancello scattasse su `DEMO_MODE=off`, quella
modalità diventerebbe inutilizzabile fuori dalla produzione e la suite E2E non
partirebbe più.

Serve quindi una dichiarazione esplicita:

| Ambiente | Come si dichiara | Cancello |
| --- | --- | --- |
| Produzione su Vercel | `VERCEL_ENV=production` (dato dalla piattaforma) | attivo |
| Preview su Vercel | `VERCEL_ENV=preview` (dato dalla piattaforma) | spento |
| Produzione fuori da Vercel | `PROEMIOS_LIVE=on` | attivo |
| CI, E2E, prove locali | nessuna dichiarazione | spento |

Su Vercel la piattaforma ha l'ultima parola: `PROEMIOS_LIVE` non può spegnere
il cancello su un deploy di produzione.

Il verso è deliberato. Chi non dichiara nulla non è il sito vero: un ambiente
di prova mal etichettato resta fuori dal cancello e al massimo funziona a
metà, mentre dimenticare la dichiarazione in produzione si nota subito, perché
non parte niente.

## Degradano in modo dichiarato

Queste possono mancare: il prodotto continua a funzionare e **dice** che quella
parte non è attiva. È una scelta — un prodotto che finge di aver mandato
un'email o emesso una fattura è peggio di uno che dichiara di non poterlo fare.

| Variabile                              | Senza                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                       | Nessuna email parte; l'errore resta accanto alla notifica                          |
| `S3_*`                                 | Si usa il filesystem: va bene in sviluppo, non su un container effimero            |
| `STRIPE_SECRET_KEY`                    | Il pagamento online risponde «non attivo, scrivici»                                |
| `STRIPE_WEBHOOK_SECRET`                | Il webhook risponde 503: senza firma non si può credere a nessun evento            |
| `INNGEST_SIGNING_KEY`                  | Le elaborazioni restano in coda invece di partire da richieste non verificate      |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Il router non trova provider configurati e il Job fallisce con un messaggio chiaro |
| `FATTURE_IN_CLOUD_*`                   | Provider `manuale`: la fattura resta `da_emettere` e si vede in elenco             |
| `WHATSAPP_*`                           | Provider spento; i link `wa.me` continuano a funzionare                            |
| `GOOGLE_ADS_*`                         | Le conversioni restano registrate e non inviate, e il funnel lo dice               |
| `NEXT_PUBLIC_CALENDAR_URL`             | Nessun pulsante di prenotazione, invece di un link rotto                           |
| `NEXT_PUBLIC_GTM_ID`                   | Nessun tag caricato                                                                |
| `NEXT_PUBLIC_DEMO_MODE`                | La fascia «Demo» segue `DEMO_MODE`; `off` la toglie, `on` la forza                 |

## Sicurezza

- `AUTH_SECRET`: `openssl rand -base64 32`. Almeno 32 caratteri, verificato.
- `STORAGE_SIGNING_SECRET`: solo per il driver filesystem, ma senza un valore
  vero gli URL firmati in sviluppo sono prevedibili.
- `NEXT_PUBLIC_*`: finiscono nel bundle del browser. Nessun segreto qui, mai.
- `GOOGLE_ADS_AZIONI`: sta in configurazione perché gli identificativi delle
  azioni cambiano quando qualcuno tocca l'account pubblicitario, e non deve
  servire un rilascio.

## Note per ambiente

**Sviluppo.** `NODE_ENV` non è di produzione, quindi la CSP ammette
`unsafe-eval` (serve al refresh di Next) e HSTS non viene emesso — bloccherebbe
`http://localhost` nel browser per i mesi successivi.

**Test di integrazione.** `TEST_DATABASE_URL` deve puntare a un database
**separato**: i test lo svuotano a ogni file.

**Anteprima.** `DEMO_MODE=on` chiude il sito ai motori e non tocca il database.
`robots.ts` è valutato a ogni richiesta e non al build, così un deploy fatto
prima di configurare il database non continua a servire `Disallow: /` dopo il
passaggio in produzione.
