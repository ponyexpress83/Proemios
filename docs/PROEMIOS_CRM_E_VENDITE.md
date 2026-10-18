# Proemios 2.0: CRM e vendite

Data: 18/10/2026. Il CRM esistente (relazioni, pipeline, preventivi, contratti, pagamenti, attribuzione, provvigioni) è invariato: vedi `CRM_ARCHITETTURA.md` e `CRM_OPERATIVO.md`. Proemios 2.0 aggiunge le parti qui sotto.

## Le mie vendite (home del venditore)

Scheda «Le mie vendite» in `/spazio`, alimentata da `GET /api/platform/crm/seller`. Gli indicatori si calcolano sulle trattative del venditore, con le stesse fasi derivate dai fatti del Kanban (proposta inviata, accettata, checkout, incasso). Ogni indicatore si apre sull'elenco delle trattative che lo compongono.

| Indicatore | Regola |
|---|---|
| Nuovi contatti | fase «Lead ricevuto», creati nelle ultime 48 ore |
| Urgenti | priorità alta o urgente |
| Da fare oggi / In ritardo | prossima azione oggi / già scaduta |
| Senza prossima azione | trattative aperte senza azione o data |
| Proposte senza risposta | «Proposta inviata» e nessuna attività da 3 giorni |
| Contratti da pagare | proposta accettata, acconto non incassato |
| Pagamenti abbandonati o falliti | checkout avviato da oltre un giorno o pagamento fallito |
| Da ricontattare | fase «Da recuperare» |
| Proposte in scadenza | scadenza della proposta entro 7 giorni |

Le soglie (proposta: 48 ore, 3 giorni, 24 ore, 7 giorni) sono una regola versionata `seller-rules` in Impostazioni CRM → Home venditori, con anteprima, approvazione e storico. Cambiano solo il raggruppamento nella home, non i record.

**Provvigioni per stato** (dal registro, nessuna stima):

| Stato | Cosa contiene |
|---|---|
| Previste | vendite attribuite al venditore ancora senza incasso. Si mostrano il numero e l'imponibile della proposta: la provvigione non viene calcolata finché non c'è un incasso |
| Maturate | su incassi verificati, da liquidare |
| Trattenute | con il motivo: pagamento contestato o rimborso al cliente |
| Pagate | liquidate |
| Rettifiche | storni per rimborsi |
| Attribuzioni da chiarire | conflitti in cui il venditore è tra i candidati; nessun accredito finché un responsabile non decide |

## Assistente commerciale

`POST /api/platform/crm/deals/:id/assistant` crea una bozza di ricontatto, una risposta, una risposta a un'obiezione o la sintesi di una telefonata.

- **Solo bozze.** La risposta ha `sent: false`, nessuna email entra in coda e il venditore copia, corregge e invia lui dal canale autorizzato.
- **Niente sconti o impegni.** Il prompt di sistema vieta sconti, rate, omaggi, date e garanzie non presenti nei fatti. Se la bozza menziona sconti o percentuali compare un avviso in cima.
- **Dati minimi.** All'AI vanno il nome di battesimo, il titolo della trattativa, la fase, il prezzo della proposta, la prossima azione e le ultime 8 attività. Non vanno email né telefono.
- **Attivazione.** Si attiva con l'opzione «Assistente commerciale» nelle regole AI approvate. Il costo resta in `ai_usage` con scopo `sales_assistant` e la richiesta resta nel registro.

## Cosa resta com'era

- Kanban e tabella delle trattative.
- La scheda del cliente con accesso limitato: il venditore vede solo i clienti che segue.
- Preventivi e negoziazioni.
- Link ai pacchetti standard.
- Attribuzione e provvigioni configurabili.

Nessuna percentuale, prezzo o regola economica è stata modificata.

## Verifica

| Voce | Stato |
|---|---|
| Home del venditore: indicatori e provvigioni | verificato nei test locali |
| Assistente: disattivato di default, bozza senza invio, nessun recapito nel prompt, avviso sugli sconti, costo registrato | verificato nei test locali con AI simulata |
| Con Anthropic reale | **non verificato** |
| Staging / produzione | no |
