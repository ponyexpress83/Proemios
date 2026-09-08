# Architettura

## In una frase

Next.js 15 (App Router) su PostgreSQL, con un livello dati che non esegue nulla
senza sapere **chi** sta chiedendo, e un motore editoriale che produce documenti
Word veri partendo dal file del cliente.

## Gli strati

```
app/            pagine e rotte. Nessuna query, nessuna logica di dominio.
  (sito)/       sito pubblico
  area/         portale cliente          ─┐
  admin/        back-office               ├─ ognuno verifica l'accesso da sé
  redazione/    banco di revisione       ─┘
  api/          endpoint pubblici e webhook

lib/dati/       il livello dati. Ogni funzione riceve un Attore per primo.
lib/dto/        allowlist esplicite, una forma per ruolo.
lib/auth/       ruoli, permessi, guardie, sessione.
lib/produzione/ segmentazione, ancoraggio, macchina a stati, motore.
lib/docx/       lettura e scrittura OOXML per innesti su stringa.
lib/ai/         router dei modelli, provider, limiti per livello.
lib/commercio/  piano di pagamento (puro).
lib/analytics/  catalogo eventi e consegna alle piattaforme.
lib/sicurezza/  intestazioni, CSP, limite di frequenza.

db/schema/      Drizzle. 38 tabelle.
config/         listino, catalogo, navigazione. Fonte di verità dei prezzi.
```

La regola che tiene in piedi la separazione: **`app/` non fa query**. Una pagina
chiama una funzione di `lib/dati/`, che è l'unico posto in cui si parla col
database e l'unico in cui si applicano i filtri di tenant e di ruolo. Se un
giorno servisse un'API pubblica, riuserebbe le stesse funzioni con gli stessi
controlli.

## Il livello dati

Ogni funzione ha questa forma:

```ts
export async function leggiQualcosa(attore: Attore, id: string) { … }
```

L'`Attore` non è un parametro di comodo: è la ragione per cui il filtro finisce
**dentro la `WHERE`**. Non esiste una versione «senza attore» da usare quando si
ha fretta, perché quella versione sarebbe la falla.

## Perché queste scelte

**node-postgres, non il driver HTTP serverless.** Servono le transazioni: un
ordine e le sue rate nascono insieme o non nascono. Il driver HTTP non le
supporta.

**Sessioni su database, non JWT.** Un JWT resta valido fino alla scadenza:
disattivare un account non lo revoca. Con le sessioni in tabella la revoca è
immediata.

**Inngest, non una coda in memoria.** Un'elaborazione editoriale dura minuti e
non può stare dentro una richiesta HTTP. Serve una coda durevole, con ritentativi,
idempotenza e concorrenza per tenant — non un array in un processo che il
deploy successivo cancella.

**Innesti su stringa OOXML, non parse e riserializza.** Un parser riscrive tutto
il documento secondo le proprie convenzioni: ordine degli attributi, namespace,
spazi. Word lo accetta quasi sempre, e «quasi sempre» sul manoscritto di un
cliente non basta. Vedi `DOCX_ENGINE.md`.

**Il limitatore in database, non in memoria.** Su serverless ogni istanza ha la
propria memoria, e un limite per istanza si aggira aprendo connessioni.

## Il percorso di una lavorazione

```
cliente carica il DOCX
      │
      ▼
  file_versions (ruolo: originale, immutabile)
      │
      ▼  creaJob
  editorial_jobs (queued) ──► Inngest ──► elaboraJob
                                             │
                              segmentazione, router, provider
                                             │
                              filtro per livello, ancoraggio
                                             │
                              editorial_interventions (pending)
                                             │
                                    Job → needs_review
      │
      ▼  banco di revisione (/redazione)
  accetta · modifica · rifiuta
      │
      ▼  approvaEditorialmente
  generaDocumentoRevisionato ──► file_versions (ruolo: revisionata)
      │                          Job → editorially_approved
      ▼  approvazione operativa (altra persona)
  Job → approved
      │
      ▼  consegna
  Job → delivered, deliverable visibile al cliente
```

Nessuna freccia salta da `needs_review` a `delivered`: la transizione non
esiste nella macchina a stati.

## Il modello AI non è cablato

Il router (`lib/ai/router.ts`) sceglie in base a: policy privacy del provider
(**primo** filtro, prima di tutto il resto), capacità richieste dal livello di
servizio, e solo alla fine il costo. Nessun nome di modello compare nel codice
di dominio; sono configurazione.

Il livello acquistato è un **vincolo sul motore**, non un'etichetta: gli
interventi fuori categoria vengono scartati prima di arrivare al revisore.

## Multi-tenant

Un'organizzazione è un tenant. Proemios è quella di tipo `studio`; ogni agenzia
white label è di tipo `agenzia`. Non c'è una tabella ponte fra agenzia e
cliente: `clients.organization_id` è l'unica fonte di verità sulla proprietà di
un cliente, e due fonti di verità sono un modo sicuro per farle divergere.

## Dove sono i confini

| Confine                    | Applicato da                                    |
| -------------------------- | ----------------------------------------------- |
| Autenticazione             | `lib/auth/sessione.ts`, in ogni pagina e azione |
| Permessi                   | `lib/auth/guardie.ts`, nel livello dati         |
| Tenant                     | dentro la `WHERE` di ogni query                 |
| Forma dei dati             | `lib/dto/`, allowlist per ruolo                 |
| Doppia approvazione        | `lib/produzione/stati.ts`                       |
| Prezzo                     | `config/pricing.ts`, mai dal client             |
| Contenuto verso il browser | CSP a nonce, `lib/sicurezza/`                   |

## Cosa non c'è, e perché

- **Nessun ORM oltre Drizzle**: le query sono SQL leggibile, e i filtri di
  sicurezza si vedono.
- **Nessuna cache applicativa**: aggiungerla prima di avere un problema di
  prestazioni significa aggiungere invalidazione da sbagliare.
- **Nessuna libreria 3D**: l'oggetto della home è CSS `transform`, animato solo
  sul compositor.
- **Nessun SDK per Fatture in Cloud, Google Ads o WhatsApp**: tre chiamate
  ciascuno, e un SDK sarebbe un aggiornamento da inseguire per anni.
