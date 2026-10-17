# Consegna CRM, 17 ottobre 2026

Estende il lavoro su marketing, preventivatore, contratti, pagamenti e progetti senza duplicarlo. Tre documenti di riferimento:

- `docs/CRM_ARCHITETTURA.md`: verifica iniziale, modello dei dati e scelta sull'isolamento;
- `docs/CRM_OPERATIVO.md`: uso quotidiano, regole in vigore, esempio completo;
- `docs/CRM_INTEGRAZIONI_API.md`: API, moduli e webhook.

Legenda: **verificato** = scritto e provato con dati e destinatari di test (prove automatiche e, dove indicato, browser); **predisposto** = scritto ma da attivare o configurare; **non fatto** = escluso o rimandato, con il motivo.

## 1. Cosa funziona davvero (verificato)

| Area | Cosa | Verifica |
|---|---|---|
| Relazioni | Contatto unico per email; richiesta, trattativa e proposte distinte; una nuova richiesta della stessa persona si aggancia alla trattativa aperta. Migrazione dei dati esistenti: 15 richieste locali → 9 contatti, 15 trattative, tutte le proposte collegate. | integrazione (scenario 1), migrazione su database con dati e su database vuoto |
| Scheda cliente | Riepilogo, collegamenti e cronologia: origine, assegnazioni, chiamate e note, proposte, contratto, incassi, progetto, passaggio, consegne, assistenza. Note private visibili solo all'autore. | integrazione (accessi fuori ambito, cronologia), browser |
| Ricerca e viste | Filtri, viste salvate personali, tabella e Kanban sulla stessa fonte | integrazione, browser |
| Doppioni | Email, telefono, account o partita IVA rendono due schede unibili; il solo nome no. Unione con permesso e motivo, collegamenti e storia conservati. | integrazione (scenario 15), nucleo |
| Team | Inviti con modello («Aggiungi venditore», Marketing, Admin con Marketing, Admin gestione team, Operatore, Collaboratore, Responsabile di produzione, Finance). Profilo con team, competenze, lingue, orari, assenze, capacità, partecipazione, limite di sconto e rate. Nessuno concede oltre i propri permessi. | integrazione (modelli di ruolo) |
| Disattivazione | Accessi chiusi subito, lavoro aperto riassegnato o in coda, storia e vendite intatte | integrazione (scenario 14) |
| Acquisizione | Origini: modulo, campagna, social, inserimento manuale, venditore, marketplace, partner/agenzie, API. Priorità, lingua, competenza richiesta, prossima azione. | integrazione (scenari 1 e 11) |
| Assegnazione | Automatica con l'ordine richiesto; coda monitorata con avviso e nuovo tentativo; scadenze in minuti di servizio con escalation senza riassegnare; coda libera con presa atomica, limite e scadenza delle prenotazioni, dati minimi prima della presa | integrazione (scenari 1–3), nucleo (orari, ora legale, assenze) |
| Attribuzione | Istantanea all'accettazione con percorso, motivi e versione della regola; percorsi A, B e C; conflitti segnalati; correzione autorizzata con nuova versione e rettifica delle provvigioni; venditore e affiliato separati; riassegnazione che non riscrive le vendite passate | integrazione (scenari 4–9) |
| Preventivi assistiti | Voci personalizzate entro soglia, eccezioni con approvazione di un'altra persona, condizioni di lavorazione nella scheda d'ordine, link protetto con scadenza e revoca, vista senza account con totale, imposte, acconto e rate, chiarimento o modifica dal link, collegamento solo con email verificata, nuova accettazione dopo una modifica | integrazione (scenario 5), browser |
| Pacchetto standard | Link dalla trattativa al catalogo (nessuna copia del prodotto, nessun dato personale), acquisto con account verificato, provvigione a chi segue | integrazione (scenario 4), browser |
| Passaggio alla produzione | Solo con contratto, ordine, incasso verificato e dati di fatturazione. Un solo progetto e un solo passaggio anche con eventi duplicati. Pacchetto con fatti contrattuali, extra, promesse non approvate, decisioni, rischi e mancanze. Domande e risposte con il venditore. Stati operativi con transizioni controllate. | integrazione (scenari 10 e 12) |
| Produzione | Più operatori e collaboratori; suggerimenti per competenza e carico con conferma; coda reclamabile per le categorie standard con presa atomica; materiali accessibili solo dopo l'assegnazione; controllo qualità separato; dipendenze tra fasi; date contrattuali separate da quelle interne | integrazione (scenario 13) |
| Il mio lavoro | Elenco, Kanban e calendario; lo spostamento aggiorna il record vero; attività personali; riepilogo del mattino, una volta al giorno | integrazione, browser |
| Prioritari | Prossima azione obbligatoria, motivi di perdita, modelli come bozze, campi personalizzati validati, pipeline configurabili («vinta» solo da incasso), anteprima dell'importazione CSV con doppioni, assistenza collegata a ordine e progetto, notifiche per persona ed evento, report senza punteggi opachi | integrazione |
| API e webhook | API v1 con OpenAPI, chiavi server e di modulo con scopi e origini, limite di richieste per chiave, idempotenza obbligatoria, revoca; webhook firmati con id evento stabile, ritentativi e nessun doppione; nessun dato personale negli eventi | integrazione (scenario 11) |
| Interfaccia | Bacheca, Trattative (tabella e Kanban), Clienti con cronologia, Coda libera, Eccezioni, Team e carichi, Regole CRM (con API, webhook e report), Passaggio nel progetto, pagina pubblica della proposta, assistenza nell'area autore | browser su server locale, desktop 1280 px e telefono 390 px, nessuno scorrimento orizzontale |

## 2. Prove e risultati

| Controllo | Risultato |
|---|---|
| `npm run typecheck` | nessun errore |
| `npm run lint` | nessun errore |
| `npm test` | **180 prove su 180**: 15 del nucleo CRM, 18 d'integrazione CRM, 147 preesistenti |
| `npm run build` | riuscita |
| Migrazioni su database vuoto | 13 su 13 applicate con `drizzle-kit migrate` |
| Migrazione su database con dati | dati collegati senza perdite |
| Browser (Chromium, server locale) | bacheca, Kanban che cambia la fase vera, link senza dati personali, pagina pubblica con totale e acconto, scheda cliente con cronologia, team, regole; tutto senza scorrimento orizzontale a 390 px |

Scenari richiesti e prova corrispondente in `tests/crm.integration.test.ts`:

1. Lead Ads verso il venditore idoneo: *routes an Ads request to the eligible seller…*
2. Nessun venditore disponibile: *queues requests when nobody is eligible…*
3. Presa contemporanea da due utenti: *lets only one of two sellers claim…*
4. Cliente seguito che acquista un pacchetto standard: *a followed client buys a standard package…*
5. Acquisto da preventivo personalizzato: *custom quote: authorized lines, approvals…*
6. Acquisto successivo senza link: *credits a later purchase without a link…*
7. Conflitto tra due trattative: *flags two open deals with different owners…*
8. Fonte Ads, affiliato e venditore insieme: *keeps Ads origin, affiliate and seller separate…*
9. Riassegnazione senza alterare vendite passate: stessa prova del punto 8.
10. Acconto verificato che crea un solo progetto: prova del punto 5, con tre eventi duplicati.
11. Webhook duplicato: Stripe al punto 5; API con la stessa chiave di idempotenza; webhook in uscita in *delivers signed webhooks…*
12. Materiali mancanti e passaggio alla produzione: *hands off with missing materials…*
13. Due operatori con competenze e carichi diversi: *suggests and assigns operators by skills and load…*
14. Disattivazione: *deactivates a seller without losing history…*
15. Tentativi fuori ambito: *refuses out-of-scope access…*, più i controlli dentro le altre prove.
16. Isolamento tra aziende: **non implementato, quindi non provato** (sezione 6).

## 3. Cosa è solo predisposto

- **Cron frequente.** Scadenze, escalation, rilascio delle prenotazioni e ritentativi dei webhook partono dal cron, che oggi gira una volta al giorno. I webhook partono comunque subito dopo le modifiche dallo spazio del team.
- **Webhook e API.** Funzionano, ma non esistono chiavi né indirizzi registrati: li crea un amministratore.
- **Inviti reali.** Usano la coda email già esistente. Senza il servizio di posta configurato (Resend) l'invito non parte e lo dice.
- **Sintesi automatiche delle chiamate.** Il campo `structured.draft` esiste, ma nessuna sintesi automatica è collegata: le chiamate partono da note strutturate scritte dalla persona.
- **Marchio.** Il nome del marchio è un'impostazione (`brand`) usata dai modelli del CRM. Le email preesistenti contengono ancora «Proemios» nel testo.

## 4. Configurazioni e credenziali che servono ancora

| Cosa | Chi | Dove |
|---|---|---|
| Orari reali dell'ufficio, scadenze, modalità per origine | proprietario | Regole CRM → Assegnazione. Il predefinito è lun–ven 9–18, Europe/Rome. |
| Finestra di relazione e cumulo venditore/affiliato | proprietario | Regole CRM → Attribuzione |
| Regola provvigionale (percentuali, vendite assistite) | proprietario | Regole economiche (già esistente) |
| Profili delle persone: competenze, lingue, capacità, assenze, limiti di sconto | chi gestisce il team | Team e carichi |
| Catalogo dei pacchetti standard (oggi: copertina, ePub, KDP, ISBN, scheda Amazon a prezzo di listino) | proprietario | impostazione `catalog`, via `PUT /api/platform/crm/settings` |
| Motivi di perdita, pipeline aggiuntive, campi personalizzati, modelli | proprietario | via API (`crm/settings`, `crm/fields`, `crm/templates`); non c'è ancora un modulo visuale |
| Cron ogni 10–15 minuti | chi gestisce l'hosting | piano Vercel adeguato o scheduler esterno su `/api/cron` con `CRON_SECRET` |
| Servizio email per inviti e notifiche | chi gestisce l'hosting | `RESEND_API_KEY`, `EMAIL_FROM` (già documentati) |
| Chiavi API e webhook | amministratore con `integrations.manage` | Regole CRM → API e webhook |

Nessuna credenziale è nel codice. Le chiavi API restano sul server come impronta; i segreti dei webhook sono cifrati.

## 5. Istruzioni ed esempio

- Aggiungere due venditori, due persone di marketing e un operatore: `docs/CRM_OPERATIVO.md`, sezione 2.
- Esempio completo dalla richiesta alla consegna: sezione 5.
- Regole effettive di attribuzione e assegnazione: sezioni 3 e 4.

## 6. Limiti che restano

- **Un'azienda per installazione.** Non c'è isolamento tra aziende nello stesso database e il prodotto non va presentato come multi-azienda (`docs/CRM_ARCHITETTURA.md`, sezioni 3 e 6).
- **Ambito dei record.** Si configura con i permessi esistenti (propri, assegnati, intera organizzazione). Non esiste ancora un ambito «del mio team».
- **Kanban.** Si sposta con un menu «Sposta in», accessibile da tastiera e telefono. Non c'è il trascinamento.
- **Calendario.** È un elenco per giorno, non una griglia mensile.
- **Configurazione via API.** Pipeline aggiuntive, campi personalizzati, modelli, motivi di perdita e catalogo hanno validazione e storia delle versioni, ma non ancora un modulo visuale.
- **Provvigioni previste.** Sono stimate sul totale accettato meno l'incassato, con la regola congelata. Le provvigioni maturate e liquidate restano quelle del registro.
- **Report.** Solo numeri e conteggi, senza grafici.
- **Pacchetto standard comprato con un'email diversa.** La proposta nasce per la persona che compra, collegata alle regole di assegnazione; vale il link e il motivo resta nell'attribuzione.

## 7. Percorso per estrarre il CRM

1. Portare testi e nomi delle email sull'impostazione `brand` e il catalogo in configurazione (in parte fatto).
2. Introdurre l'isolamento completo per azienda: `tenant_id` con Row Level Security, prefissi dei file, chiavi di cache, payload dei lavori, cassaforte delle credenziali. Poi le prove di isolamento (lettura, file, export, lavori, credenziali tra due aziende).
3. Spostare `lib/crm-core` in un pacchetto con le sue migrazioni. Mantenere i moduli editoriali (listino, manoscritti, fasi editoriali, scheda d'ordine) come estensioni.
4. Aggiungere moduli visuali per pipeline, campi, modelli e catalogo; ambito «team»; cron frequente gestito.
5. Solo dopo: licenze, fatturazione SaaS e marketplace di estensioni. Oggi esistono solo i punti di estensione: regole versionate, campi personalizzati, eventi, webhook e API v1.

Dipendenze e licenze: `docs/DIPENDENZE_E_LICENZE.md`. Nessuna dipendenza nuova.
