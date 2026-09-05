# Modello dati

PostgreSQL, schema Drizzle in `db/schema/`, diviso per dominio. Migrazioni in
`drizzle/`, rollback in `drizzle/down/`.

## Convenzioni

- **Importi in centesimi**, sempre `integer`. Nessun float sui prezzi.
- **`organization_id` su ogni entità di tenant.** Il filtro è applicato nel
  livello dati (`lib/dati/`), dentro la clausola `WHERE` — mai a valle di una
  query paginata, dove il `LIMIT` avrebbe già selezionato righe altrui.
- **Nessun binario in database.** I file vivono nello storage; qui c'è la
  chiave opaca, l'hash SHA-256 e i metadati.
- **Nessun testo integrale di manoscritto** in log, audit, metadati o prompt
  registrati.
- Nomi di colonna in `snake_case` inglese (portabilità degli strumenti SQL),
  identificatori TypeScript in italiano, come il resto del repository. Fanno
  eccezione `users.name` e `users.image`, che portano i nomi previsti dal
  contratto di Auth.js perché l'adapter ne è proprietario.

## Domini

| File                | Contenuto                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `comuni.ts`         | enum condivisi, colonne temporali                                                                                         |
| `organizzazioni.ts` | `organizations` — il tenant                                                                                               |
| `utenti.ts`         | `users`, `accounts`, `sessions`, `verification_tokens`, `staff_accounts`, `inviti`                                        |
| `crm.ts`            | `clients`, `leads`, `lead_events`, `quotes`, `quote_items`, `manuscript_analyses`, `agency_leads`                         |
| `commercio.ts`      | `orders`, `contracts`, `payments`, `invoices`                                                                             |
| `progetti.ts`       | `projects`, `project_members`, `project_stages`, `milestones`, `tasks`, `messages`, `clarification_requests`, `approvals` |
| `file.ts`           | `files`, `file_versions`, `deliverables`                                                                                  |
| `produzione.ts`     | `editorial_jobs`, `ai_job_runs`, `editorial_interventions`, `reviews`                                                     |
| `sistema.ts`        | `audit_events`, `notifications`, `provider_policies`                                                                      |

## Scelte che vale la pena spiegare

### Il tenant è `organizations`, non una tabella agenzie

Proemios stesso è un'organizzazione di tipo `studio`; ogni agenzia white label
è un'organizzazione di tipo `agenzia`. `users.organization_id` non è mai nullo,
nemmeno per lo staff dello studio: così il filtro di tenant è **una sola
regola senza eccezioni da ricordare**.

Il capitolato elencava `agency_accounts` e `agency_clients` come tabelle a sé.
Sono rappresentate da `organizations.tipo = 'agenzia'` e da
`clients.organization_id`. Una tabella ponte fra agenzia e cliente sarebbe
ridondante rispetto alla colonna di tenant, e due fonti di verità sulla
proprietà di un cliente sono un modo affidabile per farle divergere.

### `leads.stage` convive con `leads.stato`

`stage` è la colonna testuale della release Ads Ready, con dati dentro.
`stato` è l'enum tipizzato della pipeline. La migrazione è additiva: la vecchia
colonna resta finché non è stata migrata e verificata, invece di trasformare i
dati esistenti in un rilascio che deve anche funzionare.

### Le versioni di file non si sovrascrivono

`file_versions` è append-only. L'originale è immutabile; ogni lavorazione crea
una riga nuova con `precedente_id` verso quella da cui deriva. La catena
`originale → lavorazione → revisionata → approvata → deliverable` è
ricostruibile a posteriori, e `hash_sha256` permette di dimostrare che il file
consegnato è quello approvato.

### `ai_job_runs` non ha una controparte cliente

Provider, modello, token, costi, latenze e riferimenti ai prompt vivono solo
qui. Non esiste un DTO cliente per questa tabella, e non deve essere ottenuto
togliendo campi: se un giorno servisse, va scritto da zero con una decisione
esplicita. `tests/dto.test.ts` presidia il confine.

I prompt contenenti testo integrale non stanno in questa tabella:
`prompt_riferimento` è la chiave di uno storage separato, cifrato, a
conservazione breve.

### `audit_events` è append-only e sanitizzato

Nessuna funzione aggiorna o cancella una riga di audit. `lib/audit/`
sanitizza i metadati prima di scriverli: rimuove le chiavi che possono
contenere testo dell'opera o segreti, tronca le stringhe lunghe, limita
profondità e lunghezza degli array. Un fallimento della scrittura di audit non
fa fallire l'operazione che stava descrivendo.

## Migrazioni

```sh
npm run db:up                 # Postgres locale (porta 5433)
npm run db:generate           # genera la migrazione dal diff dello schema
npm run db:genera-rollback 0003_x   # genera il file di rollback, da rileggere
npm run db:migrate            # applica
npm run db:rollback           # annulla l'ultima migrazione applicata
npm run db:seed               # dati di sviluppo + organizzazione studio
```

**Ogni migrazione deve avere il suo rollback** in `drizzle/down/`.
`npm run db:rollback` rifiuta di procedere se manca. Il generatore ricava il
rollback dal SQL in avanti e segnala le istruzioni di trasformazione che non
sa annullare: quelle vanno scritte a mano.

Il round trip della migrazione 0002 è verificato: 36 tabelle → rollback → 4 →
riapplicazione → 36, senza perdere le colonne introdotte dalla 0001.
