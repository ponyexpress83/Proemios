# Privacy e conformità

Questo documento descrive **come il prodotto tratta i dati**. Non è
un'informativa legale né una consulenza: l'informativa pubblica è
`/privacy`, e va rivista da chi di dovere prima del go-live.

## Cosa trattiamo

| Dato                      | Perché                                    | Dove                               |
| ------------------------- | ----------------------------------------- | ---------------------------------- |
| Nome, email, telefono     | Contatto commerciale e accesso al portale | `leads`, `clients`, `users`        |
| Dati di fatturazione      | Obbligo fiscale                           | `clients`, congelati in `invoices` |
| Manoscritti               | È il servizio                             | Storage, mai in database           |
| Attribuzione (gclid, utm) | Misurare le campagne                      | `leads.attribution`, `conversions` |
| Origine della richiesta   | Limitare l'abuso dei form                 | `rate_limits`, **hashata**         |

## Il manoscritto

È il dato più delicato che il prodotto tocca, e non perché sia un dato
personale: è il lavoro di anni di una persona.

- **Non sta in database.** Sta nello storage, dietro chiavi opache e URL firmati
  che scadono in cinque minuti.
- **Non finisce nei log.** Nessun messaggio di errore, nessun evento di audit e
  nessun payload di analytics contiene testo del manoscritto.
- **L'originale non si tocca mai.** Ogni lavorazione produce una versione nuova;
  lo storage rifiuta la scrittura su una chiave già usata.
- **L'estratto usato per l'analisi ha una vita breve**:
  `MANUSCRIPT_RETENTION_DAYS`, trenta giorni di default.

## AI e dati

Un modello non viene interpellato se il suo provider non ha una **policy privacy
approvata** in database (`provider_policies`): addestramento escluso, zero data
retention, DPA disponibile, regione dei dati. Il cancello privacy è il **primo**
filtro del router, prima della qualità e prima del costo — un provider che non
passa non viene considerato, qualunque sia il suo punteggio.

I prompt che contengono testo integrale non stanno in database: `aiJobRuns`
conserva un riferimento a uno storage separato, non il prompt.

## Analytics

Nel `dataLayer` non passa **nessun dato personale**: `payloadDataLayer` scarta
ogni parametro il cui nome somigli a un campo identificante. Il `dataLayer` è
leggibile da qualunque script sulla pagina, estensioni del browser comprese.

Nelle conversioni server-side finisce solo l'attribuzione (gclid, utm, landing),
mai email, nome o telefono. Un test lo verifica sul contenuto scritto in
database.

Il limitatore di frequenza conserva un **hash** dell'origine, non l'origine: per
contare basta sapere che due richieste vengono dalla stessa parte, non quale
sia. `ripulisci()` cancella le finestre vecchie, così la tabella non diventa un
elenco di chi è passato.

## Consensi

`consensoPrivacy` e `consensoMarketing` sono colonne separate su `leads`, e la
casella non è mai pre-spuntata (`Consenso` in `components/ui/campi.tsx`). Sono
due consensi distinti perché coprono due trattamenti distinti.

## Diritti dell'interessato

| Diritto       | Come si esercita oggi                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accesso       | Il cliente vede i propri dati nell'area riservata; per l'export serve una richiesta a operations                                                     |
| Rettifica     | Anagrafica modificabile dal profilo e dal back-office                                                                                                |
| Cancellazione | Richiesta a operations: comporta la cancellazione dei file dallo storage e l'anonimizzazione delle righe che vincoli fiscali impongono di conservare |
| Portabilità   | I file originali sono scaricabili dall'area riservata                                                                                                |
| Opposizione   | `consensoMarketing` revocabile                                                                                                                       |

**Da completare prima del go-live**: una procedura scritta per la cancellazione,
con i termini di conservazione fiscale (dieci anni sui documenti contabili) e chi
la esegue. Il codice permette di farla; la procedura è una decisione
organizzativa, non tecnica.

## Sub-responsabili

| Chi                       | Cosa tratta                             | Dove                      |
| ------------------------- | --------------------------------------- | ------------------------- |
| Neon (o altro PostgreSQL) | Tutti i dati strutturati                | UE                        |
| S3-compatibile            | Manoscritti e deliverable               | UE (obbligatorio)         |
| Resend                    | Email transazionali                     | Verificare la regione     |
| Stripe                    | Pagamenti                               | Irlanda/USA, con SCC      |
| Anthropic / OpenAI        | Testo dei manoscritti in elaborazione   | Solo con policy approvata |
| Fatture in Cloud          | Dati di fatturazione                    | Italia                    |
| Inngest                   | Metadati dei job, **non** i manoscritti | Verificare la regione     |
| Google Ads                | Conversioni offline con gclid           | USA, con SCC              |

Un DPA firmato per ognuno è un prerequisito del go-live, non un'attività
successiva.

## Cookie

L'attribuzione usa un cookie proprio (`proemios_attribution`), tecnico e a vita
breve. GTM carica ciò che è configurato lì: **se si attivano tag di
profilazione, serve un banner di consenso conforme**, che oggi non c'è. È una
decisione che precede l'attivazione dei tag, non che la segue.

## Conservazione

| Dato                      | Quanto                                  |
| ------------------------- | --------------------------------------- |
| Estratti per l'analisi    | `MANUSCRIPT_RETENTION_DAYS` (30 giorni) |
| Finestre del limitatore   | 24 ore (`ripulisci`)                    |
| Audit                     | Da decidere: proposta 24 mesi           |
| Documenti contabili       | Dieci anni, per obbligo di legge        |
| Manoscritti e deliverable | Fino a richiesta di cancellazione       |

Le voci «da decidere» sono decisioni di conservazione, e vanno prese da chi ha
titolo per prenderle prima del go-live.
