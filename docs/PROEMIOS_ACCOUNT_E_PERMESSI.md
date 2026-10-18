# Proemios 2.0: account e permessi

Data: 18/10/2026. I permessi si verificano sempre sul server. I pulsanti nascosti nell'interfaccia sono una comodità, non una protezione.

## Proprietario e admin

- **Proprietario (Super Admin)**: ha tutti i permessi, è unico e viene impostato con `PROEMIOS_OWNER_EMAIL` su un'email verificata. Non si assegna con un modello di ruolo.
- **Admin**: ha solo i permessi del suo modello. Un admin non diventa proprietario e non può delegare più di quanto ha.

## Modelli di ruolo (invito da Persone e accessi)

| Ruolo richiesto | Modello | Cosa può fare | Cosa non può fare |
|---|---|---|---|
| Super Admin | proprietario | tutto | — |
| Admin generale | `admin_general` | CRM, team (inviti, ruoli), report, stato delle operazioni, marketing in lettura | finanza, chiavi, regole economiche |
| Admin commerciale | `admin_sales` | CRM completo, eccezioni sugli sconti, provvigioni in lettura, importazioni | finanza, ruoli |
| Admin Marketing | `admin_marketing` | CRM e area marketing | finanza, chiavi, ruoli |
| Admin gestione team | `admin_team` | inviti, profili, assegnazioni | finanza, regole |
| Responsabile produzione | `production_manager` | tutti i progetti in produzione: assegnazioni, file, consegne, coda AI, revisioni, Cabina di regia (sezione produzione) | CRM, finanza, impostazioni |
| Coordinatore | `ops_lead` | i progetti che coordina | progetti non assegnati |
| Editor | `operator` | i progetti a cui è assegnato: Studio, proposte, consegne se assegnato | assegnare, decidere i cicli, coda AI generale |
| Collaboratore esterno | `collaborator` | come l'editor, segnato come esterno | — |
| Commerciale | `seller` | le proprie trattative, Le mie vendite, assistente in bozza | trattative altrui, rivendicare clienti di colleghi |
| Affiliato | `affiliate` | le proprie conversioni e provvigioni, senza dati dei clienti | il resto |
| Finance | `finance` | incassi, fatture, provvigioni, costi di progetto, marginalità | manoscritti, documenti |
| Cliente | autore (registrazione) | i propri progetti, il testo consegnato, osservazioni e richieste di revisione | tutto ciò che è interno |

I modelli non ampliano i permessi predefiniti. Il ruolo «Responsabile produzione» è nuovo: aggiunge l'accesso a tutti i progetti di produzione, che il coordinatore base non ha, e niente altro.

## Permessi delle funzioni nuove

| Azione | Permesso richiesto |
|---|---|
| Creare il documento di lavoro, decidere proposte, modificare il testo, avviare l'AI | `project.write` sul progetto (assegnato o di organizzazione); mai il cliente |
| Approvare e consegnare una versione | `file.deliver`; in controllo qualità solo il responsabile della qualità (o il proprietario) |
| Decidere un ciclo di revisione, indicare i cicli inclusi, cambiare l'accesso del cliente, collegare o condividere Google | `project.assign` |
| Sospendere, riprendere, riprovare o annullare una lavorazione AI | `project.assign`, `operations.write` o `settings.manage` |
| Sospendere o riprendere le automazioni | `operations.write` o `settings.manage` |
| Collegare l'account Google | `integrations.manage` o `settings.manage` |
| Regole AI, costi e revisioni | `settings.manage` (anteprima e approvazione) |
| Registrare costi di progetto | `finance.record` o `settings.manage` |
| Marginalità | `finance.read` o `settings.manage` |
| Assistente commerciale | `crm.write` sulla trattativa, più l'attivazione nelle regole AI |

## Verifica

Verificato nei test locali (`tests/studio.integration.test.ts`, `tests/crm.integration.test.ts`):
- il cliente non crea documenti di lavoro e non apre le rotte del team;
- un altro cliente non vede nulla;
- l'editor non decide cicli, non indica i cicli inclusi e non vede la coda generale;
- la finanza non vede il marketing;
- il venditore non vede la Cabina di regia né la marginalità.

Non verificato su staging.
