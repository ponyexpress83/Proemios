# CRM: guida operativa

Per chi usa e configura il CRM ogni giorno. Il modello dei dati e la scelta sull'isolamento sono in `docs/CRM_ARCHITETTURA.md`; API e webhook in `docs/CRM_INTEGRAZIONI_API.md`.

## 1. Dove si trova cosa (spazio del team, `/spazio`)

| Scheda | Chi la vede | A cosa serve |
|---|---|---|
| Il mio lavoro | chi ha compiti (vendite, marketing, produzione) | Elenco, Kanban e calendario delle proprie cose: primi contatti, trattative, compiti, progetti, eccezioni da decidere, domande della produzione, assistenza. Riepilogo in alto. |
| Trattative | vendite e direzione | Tabella o Kanban sulla stessa fonte, filtri, viste salvate, nuova trattativa. Spostare una scheda cambia la fase vera. |
| Clienti | vendite e direzione | Scheda del cliente con riepilogo, collegamenti, possibili doppioni e cronologia completa. |
| Richieste | vendite e direzione | Ogni ingresso (sito, campagna, marketplace, importazione, API), con origine e assegnazione. |
| Coda libera | venditori che partecipano | Richieste da prendere in carico, con dati minimi fino alla presa. |
| Eccezioni | chi scrive proposte | Sconti oltre soglia e voci personalizzate in attesa; chi ha `quote.approve` decide. |
| Team e carichi | chi gestisce assegnazioni o team | Persone, ruoli, competenze, lingue, capacità, assenze, carico attuale; inviti con modello; disattivazione. |
| Regole CRM | tutto il team (lettura), proprietario (modifica) | Assegnazione, scadenze, coda libera, attribuzione, storia delle versioni, API e webhook, report. |
| Progetto → Passaggio alla produzione | produzione e venditore della trattativa | Condizioni, mancanze, incongruenze, fatti contrattuali, promesse ed extra, domande e risposte, stato operativo, fasi e suggerimenti. |

Il cliente vede la proposta da `/proposta/<link>` senza account. Accetta o compra dopo l'accesso con la sua email verificata. Chiede assistenza dalla sua area, dentro il progetto.

## 2. Aggiungere due venditori, due persone di marketing e un operatore

Serve un account con `invite.manage` (il proprietario, o un «Admin gestione team»). L'operazione richiede una verifica in due passaggi recente.

1. **Team e carichi → Aggiungi una persona.**
2. Ruolo **«Aggiungi venditore»**, email della persona, lingue (`it, en`), competenze o servizi (`editing, cover`), capacità (es. `20` trattative aperte). Invia.
3. Ripeti per il secondo venditore.
4. Ruolo **Marketing** per la prima persona di marketing.
5. Per la seconda scegli **Marketing** oppure **Admin con Marketing** («Admin 2»). Il secondo dà l'area marketing e il CRM, ma non finanza, chiavi, ruoli o le prerogative del proprietario.
6. Ruolo **Operatore di produzione** con competenze (`editing, proofreading`) e capacità (es. `5` fasi aperte). Per un collaboratore esterno scegli **Collaboratore esterno**: vede solo le fasi che gli vengono assegnate.
7. Ogni persona riceve un invito personale valido 48 ore. Accetta con lo stesso indirizzo e attiva la verifica in due passaggi.
8. Dopo l'accettazione, in **Team e carichi → Modifica** si completano orari, assenze, limite di sconto personale e partecipazione all'assegnazione.

Nessuno può concedere più di ciò che ha: un modello con permessi che chi invita non possiede viene rifiutato dal server.

## 3. Regole di assegnazione in vigore

Versione predefinita `assegnazione-2026-10-v1`, modificabile in **Regole CRM** con una nuova versione. Ogni assegnazione registra regola e motivo.

1. **Responsabile della trattativa aperta**: se la persona ha già una trattativa aperta, la nuova richiesta va lì, allo stesso responsabile.
2. **Persone attive che partecipano**: per i venditori la partecipazione è attiva per impostazione; gli altri ruoli partecipano solo se lo dichiara il loro profilo.
3. **Competenza e lingua**: la competenza richiesta (es. il servizio singolo) deve essere nel profilo; un profilo senza competenze vale come generico. La lingua della richiesta deve essere tra quelle del profilo (predefinita `it`).
4. **Assenze e capacità**: chi è assente o ha raggiunto la capacità è escluso.
5. **Orario di servizio**: si preferisce chi è in orario. Se nessuno lo è, la richiesta va a chi rientra per primo, e la scadenza parte da lì.
6. **Carico**: a parità, vince il carico relativo più basso (trattative aperte diviso capacità), poi chi ha ricevuto meno di recente.
7. **Nessuno idoneo**: coda monitorata, avviso a chi gestisce l'assegnazione, nuovo tentativo dal cron nel primo periodo utile.

La presenza online non conta mai. Una trattativa in corso **non viene mai spostata da sola**: le scadenze mancate producono avvisi e un'escalation, non riassegnazioni.

**Scadenze della prima risposta** (minuti di servizio, configurabili): urgente 60, alta 120, normale 480, bassa 1440. Dopo la scadenza più 120 minuti scatta l'escalation a chi gestisce l'assegnazione. La prima risposta è registrata dalla prima attività in uscita o dall'invio della proposta.

**Modalità**: automatica (predefinita), manuale (resta da assegnare e avvisa chi gestisce) e coda a scelta libera, anche diverse per origine.

**Coda a scelta libera**: presa in carico atomica, cioè vince una sola persona. Al massimo 3 prenotazioni a testa senza risposta. Una prenotazione senza prima risposta torna in coda dopo 120 minuti. Prima della presa si vedono solo nome di battesimo, origine, servizio, lunghezza, lingua e priorità.

## 4. Regole di attribuzione in vigore

Versione predefinita `attribuzione-2026-10-v1`. L'istantanea si prende **all'accettazione** (il contratto), con percorso, motivi, prove e versione della regola. Restano fatti separati:

- prima e ultima origine di marketing;
- affiliato;
- chi ha portato il contatto;
- responsabile al momento della vendita;
- venditore accreditato;
- chiusura assistita o autonoma.

| Percorso | Venditore accreditato |
|---|---|
| A. Proposta personalizzata preparata dal team | il responsabile della trattativa (vendita assistita) |
| B. Link a un pacchetto standard dalla trattativa | il responsabile della trattativa da cui nasce il link (vendita assistita). Se l'email verificata di chi compra è diversa, vale il link e il motivo resta registrato. |
| C. Acquisto successivo dal sito o dall'account | se la proposta è stata lavorata da un venditore, lui; altrimenti, **con identità verificata**, il venditore con una relazione recente (trattativa aperta o vinta negli ultimi 90 giorni). In mancanza, acquisto autonomo. |

- **Conflitti**: se più venditori hanno trattative aperte o relazioni recenti con lo stesso cliente, la vendita resta «da decidere». La provvigione del venditore è sospesa e la direzione riceve un avviso. Nessuna scelta silenziosa.
- **Correzioni**: richiedono `attribution.correct`, verifica recente e un motivo. Creano una nuova versione e la precedente resta. Le provvigioni già maturate si correggono con uno storno e una nuova riga, mai cancellando.
- **Riassegnazioni dopo la vendita**: non cambiano l'istantanea né le provvigioni, nemmeno sugli incassi successivi (saldo, rate).
- **Venditore e affiliato**: provvigioni separate. Se sono la stessa persona ne matura una sola. La regola di cumulo (entrambi, solo venditore, solo affiliato) è configurabile.
- **Prospetto provvigioni**: separa *previsto* (proposte accettate non ancora incassate), *maturato sugli incassi* (in attesa o sospeso, rettifiche comprese) e *liquidato*. Rimborsi e rettifiche aggiungono righe, non cancellano.

## 5. Esempio completo, dalla richiesta alla consegna

È lo stesso percorso verificato in `tests/crm.integration.test.ts` con destinatari di test.

1. **Richiesta.** Una persona arriva da una campagna Ads e chiede la correzione bozze. Nasce la richiesta (origine «campagna», competenza `proofreading`). Nasce o si riusa la scheda cliente (una per email). Si apre una trattativa con prossima azione «Primo contatto» entro la scadenza.
2. **Assegnazione.** Va alla venditrice con la competenza e la lingua giuste, in orario e con meno carico. Lei riceve la notifica e la richiesta compare in **Il mio lavoro**.
3. **Primo contatto.** La venditrice registra la telefonata con sintesi, decisioni e prossimi passi. La scadenza si ferma.
4. **Proposta.** Prepara la proposta e aggiunge una voce personalizzata: entro 150 € la decide lei, oltre serve un'approvazione. Fissa revisioni ed esclusioni, poi condivide il link protetto.
5. **Il cliente legge senza account.** Vede totale, IVA, acconto e rate, e può chiedere un chiarimento o una modifica dal link.
6. **Accettazione.** Il cliente accede con la sua email verificata, collega la proposta e accetta condizioni e scheda d'ordine. Nasce il contratto. Una modifica successiva richiede una nuova accettazione.
7. **Attribuzione.** L'istantanea registra il percorso «proposta personalizzata», la venditrice accreditata e la vendita assistita.
8. **Incasso.** Stripe conferma l'acconto (eventi duplicati compresi): un solo progetto, un solo passaggio alla produzione, una sola provvigione. La trattativa è vinta ed esce dal carico della venditrice.
9. **Passaggio.** Lo stato operativo parte da «in attesa dei materiali». Il pacchetto riunisce il servizio, la versione accettata, il contratto, gli importi, i fatti contrattuali, le promesse non approvate, gli extra fuori contratto, le decisioni delle chiamate e le mancanze.
10. **Domande.** La produzione fa una domanda e la venditrice risponde. Le promesse vengono approvate o respinte. Il passaggio viene accettato.
11. **Materiali.** Il cliente carica il manoscritto: lo stato diventa «pronto per l'assegnazione».
12. **Fasi.** La responsabile pianifica le fasi (editing, correzione in coda reclamabile, controllo qualità). Il sistema suggerisce gli operatori per competenza e carico. L'assegnazione si conferma a mano e solo allora l'operatore accede ai materiali. Le dipendenze tra fasi sono rispettate e il controllo qualità va a una persona diversa da chi ha lavorato.
13. **Consegna.** Gli stati avanzano: in lavorazione, controllo qualità, revisione del cliente (con la consegna), concluso.
14. **Assistenza.** Se il cliente chiede aiuto dalla sua area, la richiesta va a chi segue il progetto e compare nella cronologia del cliente.

## 6. Altre funzioni prioritarie

- **Prossima azione obbligatoria**: una trattativa aperta non si salva senza una prossima azione con data.
- **Motivi di perdita**: elenco configurabile («Altro» richiede una nota).
- **Modelli**: email come bozze da rivedere (variabili `{{nome}}`, `{{responsabile}}`, `{{prossima_azione}}`, `{{marchio}}`). Nessun invio parte dal modello. Le liste di controllo seguono lo stesso schema.
- **Campi personalizzati**: per cliente, azienda, trattativa e richiesta, validati sul server.
- **Pipeline configurabili**: la pipeline «Vendite» resta quella predefinita, con le fasi derivate dai fatti. Se ne possono aggiungere altre, in cui «vinta» arriva comunque solo da un incasso.
- **Importazione CSV**: con origine dichiarata e doppioni scartati. L'assegnazione segue le regole solo se richiesto (`assegna=regole`). L'esportazione CSV già esistente filtra per permessi.
- **Notifiche**: per persona ed evento (interne, email, entrambe, nessuna). Il riepilogo del mattino arriva una volta al giorno.
- **Report**: tempi di prima risposta (mediana e quota entro la scadenza), conversione per origine e responsabile, carico di vendite e produzione, ritardi, motivi di perdita. Solo conteggi, nessun punteggio automatico.
- **Doppioni**: email, telefono, account o partita IVA in comune rendono due schede unibili. Il solo nome produce un avviso e non permette l'unione. L'unione richiede `crm.merge` e un motivo, sposta richieste, trattative e assistenza, e conserva la fotografia della scheda unita.
- **Note private**: visibili solo a chi le scrive, anche per il proprietario.
- **Disattivazione**: chiude subito ruoli, sessioni e chiavi create dalla persona. Riassegna o rimette in coda richieste, trattative e compiti. Toglie l'accesso ai progetti. Non tocca vendite, attribuzioni e provvigioni passate. La riattivazione è possibile.

## 7. Cron e tempi

Il cron di manutenzione (`/api/cron`, oggi una volta al giorno alle 5 UTC in `vercel.json`) esegue:

- scadenze ed escalation;
- nuovi tentativi della coda;
- rilascio delle prenotazioni scadute;
- riepilogo del mattino;
- consegna e ritentativi dei webhook.

Con un solo passaggio al giorno escalation e rilascio delle prenotazioni arrivano in ritardo. Per i tempi previsti dalle regole serve un passaggio ogni 10–15 minuti: un piano Vercel che lo consenta o uno scheduler esterno che chiami `/api/cron` con il segreto. I webhook partono comunque subito dopo ogni modifica fatta dallo spazio del team.
