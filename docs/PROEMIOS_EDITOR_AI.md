# Proemios 2.0: motore editoriale AI e revisioni del cliente

Data: 18/10/2026. Codice: `lib/platform/ai-client.ts`, `lib/platform/documents/ai-engine.ts`, `lib/platform/documents/revisions.ts`. Chiamate API lato server; Claude Code non è coinvolto.

## Condizioni per avviare una lavorazione

| Tipo | Condizione | Se manca |
|---|---|---|
| Tecnica | `EDITORIAL_AI_ENABLED=1` e `ANTHROPIC_API_KEY` nell'ambiente | 409 con il motivo |
| Autorizzativa | regole AI approvate (modello, impegno, tetto per lavorazione, tetto mensile) e tetto mensile non raggiunto | 409 |
| Commerciale | progetto avviato da un incasso verificato e contratto accettato | 409 `NOT_STARTED` / `NO_CONTRACT` |
| Operativa | nessun'altra lavorazione aperta sul documento | 409 `AI_BUSY` |

## Servizi

Correzione di bozze, editing leggero, editing profondo, revisione di stile, riscrittura, revisione richiesta dal cliente (proposte sul testo), valutazione strutturale, analisi, scheda e brief (solo note interne).

## Come lavora

1. **Suddivisione.** Il testo (o i paragrafi selezionati) si divide in porzioni di circa 1.200 parole. Ogni porzione riceve:
   - due paragrafi precedenti di contesto, in sola lettura;
   - il glossario dei nomi, che si arricchisce porzione dopo porzione;
   - le istruzioni;
   - per le revisioni del cliente, le sue richieste e il testo originale per eventuali ripristini.
2. **Coda persistente.** Ogni lavorazione ha un lease di 120 s, così due processi non lavorano la stessa. Si elabora dal lavoro frequente (25 s per giro), dall'endpoint dedicato `/api/jobs/ai` (fino a 300 s) e subito dopo l'avvio. Un'interruzione riparte dalla porzione successiva senza ripetere quelle già fatte.
3. **Proposte strutturate.** Ogni proposta riporta paragrafo, tratto originale, proposta, motivo, categoria, origine AI e stato «in attesa».
   - Il server scarta le proposte con un tratto inesistente o ambiguo, le proposte sovrapposte e gli inserimenti nei servizi che non li prevedono, e conta gli scarti.
   - Le note diventano commenti interni.
4. **Costi e limiti.**
   - Prima di ogni porzione si stima il costo. Se si supererebbe il tetto della lavorazione, questa si ferma («Budget raggiunto») e avvisa.
   - Si riprende solo con una decisione registrata, che aggiunge il tetto per lavorazione in vigore.
   - Il tetto mensile blocca nuovi avvii e nuove porzioni.
   - La pausa globale dal pannello ferma tutto.
5. **Errori.**
   - Errori temporanei (limiti, 5xx, rete, timeout): nuovo tentativo con attesa crescente.
   - Errori definitivi: la lavorazione fallisce e avvisa.
   - Rifiuto, risposta troncata o non conforme: fino a 3 tentativi, poi la porzione è «non elaborata» e si può riprovare.
6. **Fine.** Lo stato diventa **«Revisione AI completata — Controllo umano richiesto»**. Responsabile operativo ed editor assegnati ricevono un avviso con il link diretto al documento nello Studio. Il testo non cambia finché una persona non decide.
7. **Testo cambiato durante la lavorazione.** Le proposte restano ancorate alla revisione di partenza: si riposizionano se possibile, altrimenti risultano «superate». Il motivo compare nella lavorazione.

## Revisioni richieste dal cliente

1. Il cliente commenta e propone sulla versione consegnata; tutto confluisce in un ciclo «in preparazione».
2. **«Invia richiesta di revisione»:**
   - verifica l'accesso;
   - raccoglie commenti e proposte;
   - calcola l'ambito (paragrafi, capitolo o tutto il testo);
   - classifica il ciclo:

| Cicli inclusi | Tipo | Cosa succede |
|---|---|---|
| non indicati (né sul progetto né nella regola per servizio) | da valutare | nessuna lavorazione parte; il responsabile decide |
| disponibili | incluso | parte l'AI mirata **solo se** le regole delle revisioni e quelle dell'AI lo consentono e l'AI è disponibile; altrimenti resta da lavorare, con il motivo |
| esauriti | extra | nessuna lavorazione; avviso alla produzione e al referente per preparare un preventivo con il flusso esistente |

3. **Decisione del responsabile.** Può classificare il ciclo come incluso, correzione di un nostro errore (senza costi), extra, extra già pagato (solo con un preventivo collegato e incassato) o non accolto (il cliente riceve il motivo). Poi può avviare l'AI mirata.
4. **Dopo l'AI:**
   - controllo umano;
   - eventuale nuova lavorazione;
   - controllo qualità;
   - approvazione della nuova versione, che chiude il ciclo e la consegna con DOCX, PDF e avviso al cliente.

I cicli inclusi si leggono dal contratto. Il foglio d'ordine li descrive a parole, quindi una persona li indica sul progetto, accanto al testo del contratto, oppure li imposta per servizio nelle regole. Nessun valore viene inventato.

## Costi AI e marginalità

- Ogni chiamata è registrata in `ai_usage`.
- Nella Cabina di regia il margine di contribuzione per progetto è: imponibile del contratto − provvigioni (escluse le trattenute) − costo AI − compenso editor − altri costi.
- Il costo AI è in dollari e si converte con il cambio approvato (`cost-rules`). Senza cambio, o senza contratto, il margine non si calcola e il progetto dice cosa manca.

## Verifica

| Voce | Stato |
|---|---|
| Condizioni, porzioni, ripresa dopo un errore senza ripetere, costi registrati, proposte valide e scartate, glossario, avviso con il link, decisioni, proposte superate, budget e ripresa autorizzata, pausa globale, rifiuti ripetuti | verificato nei test locali con **trasporto Anthropic simulato** |
| Cicli: da valutare, decisione, AI mirata, controllo qualità, nuova consegna, conteggio dei cicli, avvio automatico, extra senza lavorazione | verificato nei test locali |
| Chiamata reale ad Anthropic (schema di output, ripiego lato server, conteggio dei token) | **non verificato** |
| Staging / produzione | no |
