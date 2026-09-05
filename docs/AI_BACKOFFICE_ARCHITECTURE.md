# Proemios — AI Back-Office e produzione editoriale

Stato: decisione architetturale vincolante

## 1. Principio di prodotto

Proemios vende al cliente un **risultato editoriale**, non l'infrastruttura usata per produrlo.

Il confine cliente/admin e rigido.

### Visibile al cliente

- servizio acquistato;
- file caricati;
- stato di avanzamento espresso in termini editoriali;
- comunicazioni e richieste di chiarimento;
- revisioni o approvazioni che richiedono una sua decisione;
- risultato finale;
- file consegnabili.

### Solo admin/back-office

- provider e modello AI;
- prompt, versioni prompt e parametri;
- log di generazione;
- token, costi e latenze;
- run, retry e confronti fra modelli;
- score di qualita interni;
- motivazioni interne e confidence;
- workflow, tool e infrastruttura usati per produrre il lavoro.

**Regola tecnica:** nessun DTO/API destinato al portale cliente deve serializzare campi provenienti da `ai_job_runs`, audit provider, costi o prompt. I campi interni devono vivere in tabelle e route admin-only.

## 2. Workflow operativo

Flusso target:

`ordine -> file originale -> Job -> Model Router -> run AI -> controlli -> eventuale seconda run -> revisione umana -> approvazione editoriale -> approvazione operativa -> artefatto consegnabile`

Stati minimi del Job:

- `queued`
- `running`
- `needs_review`
- `needs_input`
- `editorially_approved`
- `approved`
- `delivered`
- `failed`
- `cancelled`

Un Job non sovrascrive mai il file originale. Ogni trasformazione produce una nuova versione/artefatto.

## 3. Human-in-the-loop obbligatorio

Per i servizi editoriali che modificano o valutano testi, **la consegna automatica senza approvazione umana non e ammessa**.

L'AI puo eseguire automaticamente la lavorazione, i retry e i controlli tecnici, ma prima della consegna un redattore/revisore autorizzato deve esaminare il risultato e approvarlo editorialmente.

### Controllato

`AI -> controlli automatici -> redattore/revisore -> approvazione editoriale -> admin/operations -> consegna`

Default per correzione bozze e revisione linguistica.

### Premium

`AI 1 -> AI 2 indipendente -> confronto -> adjudication -> redattore/editor umano -> approvazione editoriale -> admin/operations -> consegna`

Default per editing stilistico/narrativo, schede editoriali premium e progetti sensibili o ad alto ticket.

### Separazione approvazione/consegna

Il redattore puo approvare il contenuto, ma non deve avere il permesso di consegnarlo direttamente al cliente. La consegna e un'azione distinta, riservata a un ruolo operativo/admin.

## 4. Livelli di intervento editoriale

### Correzione bozze

Solo errori oggettivi e uniformita tipografica. Conservazione rigorosa della voce dell'autore.

Categorie tipiche: refuso, ortografia, punteggiatura, grammatica certa, uniformita tipografica.

### Revisione linguistica

Correzione bozze + sintassi, chiarezza, ripetizioni, ambiguita locali.

### Editing stilistico

Interventi piu profondi su ritmo, voce, struttura delle frasi, lessico e leggibilita.

### Editing narrativo

Analisi e intervento su struttura, personaggi, ritmo, POV, coerenza, dialoghi, arco narrativo e funzionamento complessivo dell'opera.

Il livello acquistato deve diventare un parametro del Job e deve limitare la massima invasivita ammessa dal motore.

## 5. Model Router

Proemios non dipende da un singolo LLM. Il router seleziona un modello in base a:

- tipo di lavoro;
- livello di intervento;
- modalita HITL;
- capacita richieste (structured output, tool use, long context, literary analysis, adjudication);
- privacy policy del provider;
- benchmark interno;
- disponibilita/costo, come criterio secondario rispetto a qualita e privacy.

I nomi modello non devono essere sparsi nel codice applicativo: sono configurazione server-side.

Strategia iniziale da verificare con benchmark su manoscritti italiani reali:

- famiglia OpenAI configurata come candidato primario per proofreading, grammatica, structured output, automazioni, tool e adjudication;
- famiglia Anthropic configurata come candidato premium/secondario per lettura critica, editing stilistico, analisi narrativa e schede editoriali;
- nessun provider viene promosso a default definitivo senza benchmark interno.

## 6. Pipeline premium multi-modello

1. Run primaria.
2. Run secondaria indipendente, senza mostrare l'output della prima al secondo modello.
3. Normalizzazione degli interventi in uno schema comune.
4. Confronto fra interventi concordanti/divergenti.
5. Adjudicator sui soli casi controversi o ad alto impatto.
6. Revisione redattore/editor.
7. Approvazione editoriale.
8. Approvazione operativa e consegna.

Questo evita di pagare il modello premium su ogni token quando non serve.

## 7. Correzione bozze DOCX professionale

### Invarianti

- il `.docx` originale e immutabile;
- il file consegnato e una copia nuova;
- la pipeline non deve convertire DOCX -> testo -> DOCX perdendo struttura;
- `mammoth` puo essere usato per estrazione/analisi, non come motore di round-trip;
- modifiche Word devono essere applicate a livello OOXML preservando quanto piu possibile stili, paragrafi, titoli, note, relazioni, numbering e metadati compatibili.

### Revisioni Word

Il motore DOCX dovra produrre Track Changes reali mediante OOXML (es. inserimenti/eliminazioni tracciate) e commenti Word quando necessario.

Ogni intervento normalizzato contiene almeno:

- categoria;
- posizione/anchor nel documento;
- testo prima;
- testo dopo;
- confidence;
- motivazione interna;
- eventuale commento destinato all'autore;
- stato revisore: pending/accepted/rejected/modified.

Categorie iniziali:

- `refuso`
- `ortografia`
- `punteggiatura`
- `grammatica`
- `sintassi`
- `ripetizione`
- `uniformita-tipografica`
- `stile`
- `dubbio-da-verificare`

### Regola di sicurezza documentale

Se la pipeline incontra elementi OOXML che non sa preservare in modo affidabile, il Job passa a `needs_review` e non consegna automaticamente un file potenzialmente danneggiato.

## 8. Schermata revisione redattore/admin

Target UX:

- codice progetto/ordine pseudonimizzato;
- servizio editoriale;
- conteggio parole;
- stato lavorazione;
- numero totale interventi;
- aggregazione per categoria;
- conteggio `da verificare`;
- originale;
- prima/dopo;
- accetta/rifiuta/modifica singolo intervento;
- accetta/rifiuta per categoria o selezione;
- richiesta di secondo controllo;
- note interne;
- scarica DOCX revisionato;
- approva editorialmente.

Funzioni come rigenerazione, cambio modello, confronto run, provider, prompt, token e costi possono essere ulteriormente limitate a `editorial_manager`/admin e non sono automaticamente disponibili a ogni revisore.

## 9. Account staff, RBAC e minimizzazione dati

Ogni dipendente/collaboratore usa un account nominativo individuale. Account condivisi vietati.

Principio: **least privilege + need to know**.

### Ruoli iniziali

- `super_admin`: accesso completo;
- `operations_admin`: clienti, progetti, assegnazioni, consegne; accesso economico solo se previsto;
- `editorial_manager`: assegna Job, vede lavorazioni editoriali e controlli AI necessari, approva/escalation; niente dati finanziari se non necessari;
- `editor_reviewer`: vede esclusivamente i Job assegnati e i dati editoriali indispensabili;
- `finance`: contratti, prezzi, fatture, pagamenti; nessun accesso ordinario ai manoscritti o agli output AI;
- `client`: solo il proprio portale e i propri deliverable.

### Dati che `editor_reviewer` NON deve vedere

- nome/cognome del cliente, salvo eccezione esplicita necessaria al testo;
- email, telefono, indirizzo e altri contatti;
- contratto;
- preventivo e prezzo;
- fatture e pagamenti;
- margine/costo commerciale;
- provenienza lead, UTM, campagna pubblicitaria;
- note commerciali;
- dati di fatturazione;
- token/costo dei provider;
- dati di altri progetti non assegnati.

### Dati che `editor_reviewer` puo vedere

- codice progetto (es. `P-184`);
- titolo/alias del manoscritto quando necessario;
- livello di servizio;
- istruzioni editoriali;
- file necessari al Job;
- interventi proposti e relative categorie;
- eventuali richieste di chiarimento editoriali filtrate dal project manager;
- storico editoriale necessario a evitare regressioni;
- scadenza e stato operativo del Job.

L'identita del cliente va pseudonimizzata nel workspace redazionale ogni volta che non e necessaria al lavoro.

### Permessi critici

- `editor_reviewer` puo `review`, `accept_intervention`, `reject_intervention`, `modify_intervention`, `request_clarification`, `mark_editorially_approved`;
- `editor_reviewer` non puo `view_contract`, `view_price`, `view_payment`, `view_client_contact`, `change_model` di default, `deliver_to_client`;
- solo ruoli autorizzati possono cambiare provider/modello, vedere costi AI, assegnare personale o consegnare al cliente.

Ogni accesso a file, approvazione, rifiuto, modifica e consegna deve produrre audit log con utente, timestamp e azione.

## 10. Privacy manoscritti inediti

La privacy e un requisito di routing, non documentazione successiva.

Ogni provider/modello deve avere una policy interna registrata con almeno:

- uso o non uso dei dati per training;
- retention standard;
- disponibilita di Zero Data Retention o equivalente;
- regione/localizzazione e trasferimenti;
- DPA disponibile;
- subprocessor rilevanti;
- compatibilita con il livello di sensibilita del Job.

Il router deve poter escludere provider non ammessi per un Job.

### Logging

- non salvare il manoscritto integrale nei log applicativi;
- non salvare prompt contenenti interi manoscritti nei log generici;
- usare riferimenti file, hash e metadati per audit;
- eventuali payload completi necessari al debug devono avere storage separato, cifrato, accesso admin ristretto e retention esplicita;
- token/costi sono dati amministrativi e mai cliente-facing.

## 11. White-label / B2B

La futura organizzazione/agenzia deve poter avere:

- propri clienti e progetti;
- branding e comunicazioni configurabili;
- ruoli/permessi;
- pipeline editoriale condivisa;
- AI e revisori Proemios invisibili al cliente finale quando il contratto white-label lo richiede.

Per questo Job, Run, File e Deliverable devono appartenere in futuro a un `organization_id`/`project_id`, non essere legati per sempre a un singolo utente.

## 12. Benchmark interno prima del default modello

Creare un corpus autorizzato di manoscritti italiani con gold set editoriale e misurare almeno:

- precisione degli errori oggettivi;
- falsi positivi;
- rispetto della voce;
- conservazione del significato;
- qualita delle motivazioni;
- capacita di individuare dubbi invece di inventare correzioni;
- qualita narrativa/stilistica per i livelli superiori;
- consistenza degli output strutturati;
- costo e latenza;
- tasso di interventi accettati dall'editor umano.

La metrica principale per proofreading non e il numero di modifiche, ma la quota di modifiche corrette accettate con basso falso positivo.

## 13. Sequenza di implementazione

1. RBAC staff + account individuali + audit log.
2. Job model + audit + privacy policy + Model Router.
3. Storage/versioning file immutabili.
4. Proof-of-concept DOCX su corpus di test complesso.
5. Schema interventi + preview redattore/admin.
6. Run controllata con un provider.
7. Secondo provider + confronto + adjudication.
8. Approvazione editoriale obbligatoria + approve/deliver separati.
9. Portale cliente con confine dati verificato.
10. Benchmark e promozione dei default.
11. Multi-tenant/white-label.

Nessuna fase deve rendere pubblici dettagli AI al cliente o dati commerciali non necessari allo staff editoriale.
