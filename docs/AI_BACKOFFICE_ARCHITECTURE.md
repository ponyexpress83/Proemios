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

`ordine -> file originale -> Job -> Model Router -> run AI -> controlli -> eventuale seconda run -> revisione admin/editor -> approvazione -> artefatto consegnabile`

Stati minimi del Job:

- `queued`
- `running`
- `needs_review`
- `needs_input`
- `approved`
- `delivered`
- `failed`
- `cancelled`

Un Job non sovrascrive mai il file originale. Ogni trasformazione produce una nuova versione/artefatto.

## 3. Modalita human-in-the-loop

### Automatico

`AI -> controlli automatici -> consegna`

Consentito solo per output a rischio basso e servizi esplicitamente configurati come automatici. Non e il default per manoscritti inediti ad alto valore.

### Controllato

`AI -> controllo admin/editor -> consegna`

Default consigliato per correzione bozze e revisione linguistica.

### Premium

`AI 1 -> AI 2 indipendente -> confronto -> adjudication -> editor umano -> consegna`

Default consigliato per editing stilistico/narrativo, schede editoriali premium e progetti sensibili o ad alto ticket.

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
6. Revisione admin/editor.
7. Produzione artefatto finale.

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
- stato admin: pending/accepted/rejected/modified.

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

## 8. Schermata admin revisione

Target UX:

- ordine e servizio;
- conteggio parole;
- stato AI;
- numero totale interventi;
- aggregazione per categoria;
- conteggio `da verificare`;
- originale;
- prima/dopo;
- accetta/rifiuta/modifica singolo intervento;
- accetta/rifiuta per categoria o selezione;
- rigenera;
- secondo controllo;
- cambia modello;
- confronto run;
- scarica DOCX revisionato;
- approva e consegna.

Provider, prompt, token e costi devono stare in un pannello tecnico admin separato, non nella vista cliente.

## 9. Privacy manoscritti inediti

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

## 10. White-label / B2B

La futura organizzazione/agenzia deve poter avere:

- propri clienti e progetti;
- branding e comunicazioni configurabili;
- ruoli/permessi;
- pipeline editoriale condivisa;
- AI e revisori Proemios invisibili al cliente finale quando il contratto white-label lo richiede.

Per questo Job, Run, File e Deliverable devono appartenere in futuro a un `organization_id`/`project_id`, non essere legati per sempre a un singolo utente.

## 11. Benchmark interno prima del default modello

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

## 12. Sequenza di implementazione

1. Job model + audit + privacy policy + Model Router.
2. Storage/versioning file immutabili.
3. Proof-of-concept DOCX su corpus di test complesso.
4. Schema interventi + preview admin.
5. Run controllata con un provider.
6. Secondo provider + confronto + adjudication.
7. Approve/deliver e portale cliente con confine dati verificato.
8. Benchmark e promozione dei default.
9. Multi-tenant/white-label.

Nessuna fase deve rendere pubblici dettagli AI al cliente.