# Ruoli, permessi e confini

## Principio

Least privilege e need to know. Un ruolo riceve un permesso solo se senza
quello non può fare il proprio lavoro.

L'autorizzazione è **sempre server-side**. Nascondere un pulsante
nell'interfaccia non è sicurezza: è cortesia verso l'utente.

## I sei ruoli

| Ruolo               | Cosa fa                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| `super_admin`       | Tutto. Va assegnato a pochissime persone.                                         |
| `operations_admin`  | Clienti, progetti, consegne, denaro in entrata. Non entra nel merito editoriale.  |
| `editorial_manager` | Qualità editoriale: assegna, guarda le run, rigenera, forza un secondo controllo. |
| `editor_reviewer`   | Il redattore. Vede il lavoro assegnato e nient'altro.                             |
| `finance`           | Cliente, contratto, prezzo, pagamenti, fatture. Non i manoscritti.                |
| `client`            | Il proprio progetto. Nessun permesso di back-office.                              |

La matrice completa è in `lib/auth/ruoli.ts`, deliberatamente esplicita e
verbosa: un elenco leggibile riga per riga è l'unico modo per accorgersi che un
ruolo ha un permesso che non dovrebbe avere.

## Cosa NON vede il redattore

Nome del cliente, email, telefono, indirizzo, dati di fatturazione, contratto,
prezzo, preventivo, fatture, pagamenti, margine, UTM, fonte del lead, note
commerciali, altri clienti, costi AI, token, prompt, provider, modelli.

Vede: codice progetto, alias o titolo di lavorazione, servizio, istruzioni
editoriali, scadenza, manoscritto, interventi, storico editoriale necessario,
richieste di chiarimento filtrate.

Non è ottenuto nascondendo campi: i DTO destinati al redattore **non hanno
quei campi**. Vedi `lib/dto/`.

## Cosa NON vede il cliente

Modello AI, provider, prompt, run, costi, token, confidenza interna, catena
tecnica, confronti fra modelli. Gli stati tecnici del Job sono tradotti in
linguaggio editoriale: `failed` diventa «In verifica», non «Fallito».

## La separazione approvazione / consegna

Il redattore approva **editorialmente**. La consegna al cliente è un'azione
distinta, riservata a operations. Nessun ruolo ha entrambi i permessi tranne
`super_admin`. È il vincolo centrale del workflow ed è presidiato da un test.

## Come è applicato

1. **`lib/auth/ruoli.ts`** — la matrice, pura e testata.
2. **`lib/auth/attore.ts`** — l'`Attore`: chi agisce, con quale ruolo, in quale
   tenant. Un account disattivato non ha alcun permesso.
3. **`lib/auth/guardie.ts`** — `esigiPermesso`, `esigiStessoTenant`,
   `esigiProprietaCliente`. Lanciano, non restituiscono booleani: una guardia
   che restituisce `false` si può ignorare per distrazione.
4. **`lib/dati/`** — ogni funzione esige un `Attore` come primo argomento e non
   espone varianti che ne facciano a meno. Dimenticare l'autorizzazione deve
   essere un errore di compilazione.
5. **`lib/dto/`** — allowlist esplicite. Mai `{ ...riga }`.

## Perché un tenant diverso risponde «non trovato»

`esigiStessoTenant` lancia `NonTrovato`, non `NonAutorizzato`. Confermare che
la risorsa esiste direbbe a un tenant che l'altro ha quell'id: la risposta deve
essere indistinguibile da quella per un id inesistente. Un test di integrazione
verifica che i due messaggi coincidano.

## Il middleware non è il livello di sicurezza

`middleware.ts` fa una cosa sola: manda alla pagina di accesso chi non ha un
cookie di sessione. Gira sul runtime edge, senza accesso al database, quindi
non può sapere se una sessione è valida, se l'account è stato disattivato o se
il ruolo è cambiato. **Un cookie presente non prova nulla.** La verifica vera
è in ogni pagina e ogni azione.

Verificato: una richiesta con un cookie di sessione inventato riceve un rimando
alla pagina di accesso, non i dati.

## Autenticazione

Auth.js v5, magic link via Resend, **sessioni su database**.

Sessioni su database e non JWT perché revocare l'accesso a una persona deve
avere effetto subito: un JWT già emesso resterebbe valido fino alla scadenza.
Un cambio di ruolo e una disattivazione cancellano le sessioni aperte, ed è
verificato da un test.

**Nessuna registrazione libera.** Si entra su invito, e l'invito è l'unico
punto in cui si assegna un ruolo. Chi invita non può assegnare un ruolo pari o
superiore al proprio: senza questa regola, chi può invitare potrebbe crearsi un
`super_admin`.

L'invito è conservato come hash SHA-256: chi legge il database non può usare
l'invito di un altro.

La richiesta del link di accesso risponde **allo stesso modo** che l'indirizzo
esista o no, ed è limitata per indirizzo IP.

## Test

- `tests/permessi.test.ts` — 39 test sulla matrice, con le esclusioni critiche
  elencate una per una.
- `tests/dto.test.ts` — 20 test che i DTO non contengano le chiavi vietate.
- `tests/sessione.test.ts` — l'oggetto servito da `/api/auth/session`.
- `tests/integrazione/isolamento.test.ts` — isolamento fra tenant su Postgres
  vero: elenco, lettura per id, modifica, cronologia, funnel, paginazione.
- `tests/integrazione/account.test.ts` — inviti, gerarchia dei ruoli, revoca
  delle sessioni, disattivazione.
