# Sicurezza

## Il principio

**L'autorizzazione è sempre lato server.** Nascondere un pulsante non è
sicurezza: è cortesia verso chi non deve premerlo. Ogni pagina, ogni azione e
ogni funzione del livello dati verifica per conto proprio, e nessuna si fida di
un controllo fatto altrove.

Il middleware **non è** il livello di sicurezza. Gira sul runtime edge, dove non
c'è accesso al database: non può sapere se una sessione è ancora valida, se un
account è stato disattivato o se un ruolo è cambiato. Fa due cose — applica le
intestazioni e manda alla pagina di accesso chi non ha un cookie — e un cookie
presente non prova nulla. Un test end-to-end verifica che un cookie inventato
superi il middleware e venga rifiutato dal server: è il comportamento voluto.

## Sessioni

Auth.js v5 con **sessioni su database**, non JWT. Un JWT è valido fino alla
scadenza qualunque cosa succeda: disattivare un account non lo revoca. Con le
sessioni in tabella, un account disattivato perde l'accesso al prossimo
caricamento di pagina.

L'accesso è a magic link: non c'è nessuna password da rubare, riusare o
dimenticare.

`/api/auth/session` ricostruisce l'oggetto di sessione da una **allowlist**
(`lib/auth/sessione-pubblica.ts`). Prima non lo faceva, e l'endpoint restituiva
la riga utente intera — `sessionToken` e `mfaSegreto` compresi. È stato trovato
provando l'endpoint con una sessione vera, non leggendo il codice, e ora c'è un
test di regressione.

## Autorizzazione

Sei ruoli, cinquantatré permessi, una matrice esplicita in `lib/auth/ruoli.ts`.
Ogni funzione del livello dati riceve un `Attore` come primo argomento e non ha
modo di leggere niente senza.

Due separazioni sono strutturali, non convenzionali:

- **chi approva editorialmente non consegna al cliente.** La macchina a stati
  non ha una transizione da `needs_review` a `delivered`;
- **chi ha approvato editorialmente non approva la consegna dello stesso Job**,
  nemmeno avendone il permesso. La separazione è sulla persona, non sul ruolo, e
  un test di integrazione lo verifica usando un `super_admin`, che i permessi li
  ha tutti.

## Isolamento fra tenant

Il filtro è **dentro la `WHERE`**, mai applicato dopo la query: ciò che un altro
tenant non deve vedere non viene selezionato. Un id di un altro tenant risponde
**404, non 403**: dire «esiste ma non è tuo» permetterebbe di scoprire quali id
esistono provandoli.

Un'agenzia non elenca le altre organizzazioni e non sa che esistano — un
rifiuto, non un elenco filtrato.

## DTO

Sono **allowlist scritte a mano**, mai `{...riga}`, e sono **forme diverse per
ruolo**, non un superinsieme filtrato: il DTO del cliente non ha un campo per il
costo di una run AI, quindi non c'è niente da dimenticare di togliere. I test
verificano che chiavi come `noteInterne`, `stripeSessionId` o `motivazioneInterna`
non compaiano nei DTO che non devono averle.

## Intestazioni

CSP a **nonce per richiesta**, generato dal middleware. Niente `unsafe-inline`
sugli script: con `unsafe-inline` attivo, uno script iniettato in pagina viene
eseguito esattamente come i nostri, e la policy non vale niente.
`unsafe-eval` esiste solo in sviluppo, dove il refresh di Next ne ha bisogno, e
dipende da `NODE_ENV` — non da una variabile che qualcuno possa impostare per
sbaglio in produzione.

`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'` (un `<base>`
iniettato riscriverebbe ogni URL relativo, form comprese), `form-action 'self'`
(una form riscritta non può mandare altrove i dati dell'utente). In produzione
anche HSTS con `preload` e `upgrade-insecure-requests`.

Una CSP sbagliata non dà errore al build: dà pagine che si caricano e non
funzionano, perché il JavaScript viene rifiutato in silenzio. Perciò
`npm run verifica:csp` le apre con un browser vero e guarda la console, e un
test end-to-end fa lo stesso.

## Limite di frequenza

In **database**, non in memoria: su un runtime serverless ogni istanza ha la
propria memoria, e un contatore per istanza si aggira aprendo connessioni finché
non se ne prende una nuova. Un limite che si aggira così non è un limite.

Il conteggio si aggiorna con una sola istruzione (`insert … on conflict do
update`), perché leggere e poi scrivere lascia una finestra in cui due richieste
contemporanee leggono lo stesso valore e passano entrambe — che è esattamente il
caso da fermare. Un test di integrazione spara venti richieste in parallelo e
verifica che ne passino esattamente cinque.

L'origine è il **primo** indirizzo di `x-forwarded-for`: gli altri sono i proxy
attraversati, e prendere l'ultimo permetterebbe di aggirare il limite con
un'intestazione costruita a mano. La chiave conserva un **hash** dell'origine:
un elenco di IP in chiaro è un dato personale che non serve conservare.

In caso di errore del database il limitatore **ammette** la richiesta: rifiutare
tutto quando il contatore non è raggiungibile trasformerebbe un problema del
limitatore nell'indisponibilità dei form pubblici. Il limite protegge
dall'abuso, non è l'ultima difesa.

## File e storage

Le chiavi sono opache (`org/<id>/prog/<id>/<ruolo>/<32 esadecimali>.<est>`) e
validate contro il path traversal. L'immutabilità è imposta **dal driver**
(`IfNoneMatch: "*"` su S3, flag `wx` sul filesystem), non da un controllo
applicativo che si può dimenticare di fare.

La validazione dei file guarda i **primi byte**, non l'estensione. Gli URL di
download sono firmati e scadono in cinque minuti; ogni accesso è registrato.

Requisiti operativi del bucket: regione UE, accesso pubblico bloccato, cifratura
a riposo, versioning attivo, credenziali con i soli permessi Get/Put/Head/Delete
sul prefisso.

## Pagamenti

Nessun importo attraversa il browser: si passa l'id della rata, e l'importo si
legge dall'ordine. Il webhook Stripe verifica la firma sul corpo grezzo — senza,
chiunque potrebbe marcare un ordine come pagato — e ogni operazione è idempotente,
perché Stripe riconsegna gli eventi.

## Segreti

Mai in codice, mai nei log, mai nei messaggi di errore. `lib/env.ts` valida le
variabili all'avvio con Zod: una che manca fa fallire l'avvio con un messaggio
che dice cosa manca, invece di produrre un errore oscuro a runtime.

I messaggi di errore verso l'esterno sono generici (`NonAutorizzato` dice sempre
la stessa cosa); il motivo vero vive in `motivoInterno` e finisce nell'audit.
`app/error.tsx` mostra il digest, non il messaggio.

## Audit

Ogni azione rilevante lascia traccia: chi, cosa, quando, su quale entità. Mai il
testo di un manoscritto, mai un segreto. Anche gli accessi negati vengono
registrati: servono a distinguere un bug da un tentativo.

## Cosa è stato provato davvero

| Verifica                                | Come                                   |
| --------------------------------------- | -------------------------------------- |
| Aree riservate irraggiungibili          | E2E su un'app costruita, nove percorsi |
| Cookie inventato rifiutato              | E2E, con cookie forgiato               |
| Intestazioni presenti e nonce variabile | E2E su ogni documento                  |
| CSP non rompe il prodotto               | Browser vero, console letta            |
| Limite di frequenza                     | 20 richieste in parallelo su Postgres  |
| `x-forwarded-for` non aggirabile        | E2E con intestazione costruita         |
| Isolamento fra tenant                   | Integrazione su Postgres, non su mock  |
| DTO senza campi vietati                 | Unitari + integrazione                 |
