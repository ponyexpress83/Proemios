# Proemios 2.0: integrazioni

Data: 18/10/2026. «Configurato» vuol dire che le variabili ci sono; «verificato» vuol dire che un fatto recente dimostra che il servizio funziona (ad esempio una consegna accettata dal provider o una chiamata riuscita). La Diagnostica in Impostazioni CRM mostra questi stati per l'ambiente in cui gira e non stampa mai segreti.

| Servizio | Uso | Variabili | Implementato | Test locali | Staging | Produzione |
|---|---|---|---|---|---|---|
| Resend | email operative (inviti, notifiche, consegne) | `RESEND_API_KEY`, `EMAIL_FROM` | sì | sì, trasporto su cartella | no | no |
| Stripe | checkout, webhook, rate, rimborsi | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | sì | sì, eventi simulati | no | parziale (funzioni precedenti al CRM) |
| Fatture in Cloud | fattura a ogni incasso | `FIC_*` | sì | sì, API simulata | no | no |
| Vercel Blob | file privati | `BLOB_READ_WRITE_TOKEN` | sì | sì, cartella locale | no | sì per le funzioni precedenti |
| Scanner dei file | controllo di DOCX e PDF | `FILE_SCANNER_URL`, `FILE_SCANNER_TOKEN` | sì | sì, scanner simulato | no | no |
| **Anthropic (motore editoriale)** | lavorazioni AI, revisioni del cliente, assistente commerciale | `ANTHROPIC_API_KEY`, `EDITORIAL_AI_ENABLED=1` più regole approvate | sì | sì, **trasporto simulato** | no | no |
| **Google Docs/Drive** | editor collaborativo del documento di lavoro | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, facoltativo `GOOGLE_REDIRECT_URI` | sì | sì, **API simulate** | no | no |
| Brevo | campagne e disiscrizioni | `BREVO_*` | sì | sì | no | no |
| GA4 | misurazione dopo il consenso | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | sì | sì | no | no |
| Pianificatore | `/api/cron` (giornaliero), `/api/cron/frequent`, `/api/jobs/ai` | `CRON_SECRET` | sì | sì | no | solo il giornaliero |

## Anthropic: motore editoriale

- **SDK ufficiale** `@anthropic-ai/sdk` 0.131, chiamate solo lato server con output strutturato validato (`client.beta.messages.parse` con uno schema zod). Se il modello rifiuta, il ripiego lato server (*server-side fallback*) è attivo e i token di ogni passaggio vengono registrati.
- **Modello e impegno** si scelgono nelle regole (`ai-rules`). La proposta da approvare è Claude Opus 5.5 con impegno medio, 15 $ per lavorazione e 300 $ al mese.
- **Costi.** Ogni chiamata registra token e costo in `ai_usage`, secondo il listino interno `anthropic-listino-2026-10` in `lib/platform/ai-client.ts` (in USD per milione di token). Prima dell'attivazione il listino va confrontato con quello ufficiale. Un modello senza prezzo non è utilizzabile.
- **Errori.**
  - Limiti, errori 5xx, rete e timeout sono temporanei: la porzione si riprova più tardi, fino a 3 volte.
  - Le altre risposte di errore fermano la lavorazione.
  - Un rifiuto o una risposta troncata o non conforme allo schema viene ritentata. Dopo 3 tentativi la porzione risulta «non elaborata» e se ne vede il motivo.
- **Dati inviati.** Il prompt di sistema dice al modello che il testo del manoscritto è un dato e non un'istruzione. L'assistente commerciale invia solo il nome di battesimo del cliente, la fase e le ultime attività: mai email o telefono.
- **Verificato.** Nulla con il servizio reale. La Diagnostica segna Anthropic «verificato» solo dopo una chiamata riuscita registrata negli ultimi 30 giorni.

**Per attivarlo:**
1. Approva i termini e il trattamento dei dati con Anthropic.
2. Imposta `ANTHROPIC_API_KEY` ed `EDITORIAL_AI_ENABLED=1` nell'ambiente di staging.
3. Approva le regole in Impostazioni CRM → AI, costi e revisioni.
4. Fai una lavorazione di prova su un testo sintetico e controlla costo e proposte.

## Google Docs

- **OAuth** con scope `openid email drive.file`: l'app vede solo i file che crea. Il token di aggiornamento è cifrato nel database e l'accesso si rinnova lato server. Se Google risponde `invalid_grant`, il collegamento risulta «revocato» e va rifatto.
- **Funzioni:**
  - crea il documento Google dal testo corrente;
  - porta in Proemios le modifiche fatte in Google come nuova revisione, mantenendo gli id dei paragrafi;
  - applica a Google il testo approvato, con `requiredRevisionId`: se Google è cambiato nel frattempo, nessuna sovrascrittura;
  - condivide il documento con il cliente solo in lettura o commento, senza email automatiche di Google.
- **Proposte.** `WriteMode.SUGGEST` delle API Docs è in Developer Preview e non è verificato sul vostro progetto Google Cloud, quindi non viene usato. Le proposte restano in Proemios e arrivano in Google solo come testo approvato.
- **Interfaccia neutra** (`EditorProvider`): un futuro ONLYOFFICE o Collabora si aggiunge come altro fornitore senza toccare il resto.

**Per attivarlo:**
1. Crea un client OAuth «Web» nel progetto Google Cloud, con l'URI di ritorno `https://<dominio>/api/integrations/google/callback`.
2. Abilita le API Docs e Drive.
3. Imposta le variabili.
4. Collega l'account da Impostazioni CRM → Diagnostica.

## Upload

Il limite resta di 4 MB per file, imposto dal corpo delle funzioni Vercel. Basta per DOCX e TXT di un romanzo. Per PDF più grandi serve il caricamento diretto su Blob con token firmato, che è lavoro successivo. Scanner e controlli non sono stati indeboliti: DOCX e PDF restano in quarantena finché lo scanner non li dichiara puliti.
