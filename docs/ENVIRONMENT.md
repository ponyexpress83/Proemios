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
