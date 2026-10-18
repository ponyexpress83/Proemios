# Proemios 2.0: architettura

Data: 18/10/2026. Ramo: `claude/proemios-complete-v1-w78xtx` (PR verso `release/team-demo-2026-10-14`).

Livelli di verifica usati: **Implementato nel codice** · **Verificato nei test locali** · **Verificato su staging** · **Operativo in produzione**. Ad oggi niente di quanto descritto qui è verificato su staging o in produzione.

## Il percorso completo

```
Marketing → CRM → Vendita → Preventivo → Contratto → Pagamento → Produzione
→ Lavorazione AI → Controllo umano → Consegna → Revisioni del cliente
→ Nuova lavorazione AI → Controllo umano → Approvazione finale
```

| Tratto | Dove vive | Stato |
|---|---|---|
| Marketing, CRM, vendita, preventivo, contratto, pagamento | moduli esistenti (`lib/platform/crm-*`, `payments.ts`, `contracts.ts`), invariati | implementato e verificato nei test locali (lavori precedenti) |
| Passaggio alla produzione, fasi e operatori | `crm-handoff.ts`, `crm-work.ts`, invariati | come sopra |
| Documento di lavoro, versioni, consegne | `lib/platform/documents/service.ts` (nuovo) | implementato, verificato nei test locali |
| Lavorazione AI | `lib/platform/documents/ai-engine.ts` + `lib/platform/ai-client.ts` (nuovi) | implementato, verificato nei test locali **con Anthropic simulato** |
| Revisioni del cliente | `lib/platform/documents/revisions.ts` (nuovo) | implementato, verificato nei test locali |
| Editor collaborativo esterno | `lib/platform/documents/google.ts` (nuovo, adattatore) | implementato, verificato nei test locali **con Google simulato** |
| Cabina di regia, marginalità, automazioni | `lib/platform/admin-dashboard.ts`, `automation.ts` | implementato, verificato nei test locali |
| Home del venditore e assistente | `lib/platform/crm-seller.ts` | implementato, verificato nei test locali (AI simulata) |

## Principi

1. **Proemios è l'archivio ufficiale.** Il file caricato dal cliente resta intatto (versione «Originale»). Il documento di lavoro è una sequenza di revisioni numerate con impronta SHA-256. Le versioni consegnate (V1, V2, Definitiva) sono immutabili, con DOCX, PDF, impronta e ciclo di revisione collegato. Google Docs, se usato, è solo l'editor collaborativo: non è un secondo archivio.
2. **Nessun progetto duplicato.** Documenti, cicli e lavorazioni puntano al progetto esistente (`platform_projects`) e, tramite il preventivo, al contratto (`orderSheet`). Le consegne usano i file di consegna esistenti (`platform_files` con `kind = delivery`), con il flusso di approvazione già in uso.
3. **Claude non modifica il testo.** Produce proposte strutturate (originale, proposta, posizione, motivo, categoria, origine, stato). Il testo cambia solo quando una persona accetta, modifica o scrive direttamente. Ogni cambiamento è una nuova revisione con blocco ottimistico: due persone non si sovrascrivono.
4. **Il cliente vede solo ciò che è consegnato.** Le sue rotte (`/api/platform/studio/client*`) sono separate da quelle del team, rifiutano gli account del team e non restituiscono lavorazioni AI, costi, note interne o proposte del team.
5. **Le spese AI hanno sempre un'autorizzazione.** Servono regole approvate (modello, tetto per lavorazione, tetto mensile), l'abilitazione dell'ambiente, l'acconto incassato e il contratto. Senza cicli di revisione indicati, una richiesta del cliente aspetta la decisione di una persona.
6. **Regole versionate.** Le nuove regole (`ai-rules`, `cost-rules`, `revision-rules`) passano da anteprima, approvazione e storico, come le altre impostazioni del CRM. Le proposte predefinite non sono valori approvati.

## Modello dei dati (migrazione `0014_document_studio`, solo aggiunte)

| Tabella | Contenuto |
|---|---|
| `doc_documents` | documento di lavoro: progetto, file originale (unico), revisione corrente e numero, editor (`internal` o `google_docs`), accesso del cliente (`read`, `comment`, `suggest`, `edit`) |
| `doc_revisions` | paragrafi `{id, text, style}`, impronta, motivo (`import`, `edit`, `accept`, `sync`), autore |
| `doc_versions` | versioni ufficiali: numero, etichetta, tipo (`original`, `delivery`, `final`), revisione, impronta, DOCX, PDF, ciclo, approvazione |
| `doc_suggestions` | proposte ancorate alla revisione di partenza: paragrafo, posizione, originale, proposta, motivo, categoria, origine (`ai`, `editor`, `client`), stato (`pending`, `accepted`, `rejected`, `modified`, `stale`) |
| `doc_comments` | commenti e note: origine (`staff`, `client`, `ai`), visibilità (`internal`, `client`) |
| `doc_revision_cycles` | richiesta di revisione del cliente: numero, tipo (`included`, `error_fix`, `extra`, `pending_decision`), stato, ambito, decisione, preventivo dell'extra, versione consegnata |
| `ai_jobs`, `ai_job_chunks` | coda persistente: servizio, ambito, istruzioni, glossario, modello, budget, spesa, porzioni con tentativi ed errori, lease |
| `ai_usage` | ogni chiamata al modello: scopo, progetto, lavorazione, trattativa, modello, token, costo in micro-dollari, versione del listino, esito |
| `project_costs` | compensi editor e altri costi diretti (in centesimi di euro) |
| `external_connections` | collegamento Google: token di aggiornamento cifrato (JWE), stato, ultimo errore |
| `platform_projects` (+2 colonne) | `revision_rounds` e `revision_rounds_set_by` |

## Rotte nuove

- `/api/platform/studio/...`: produzione, coda AI, documenti, proposte, versioni, cicli, Google, area del cliente (`lib/platform/documents/router.ts`).
- `/api/platform/crm/admin`, `/crm/admin/margins`, `/crm/projects/:id/costs`, `/crm/automation/:job/:action`, `/crm/seller`, `/crm/deals/:id/assistant`.
- `/api/jobs/ai`: elaborazione della coda (protetta da `CRON_SECRET`, durata fino a 300 s).
- `/api/integrations/google/callback`: ritorno dall'autorizzazione Google.

## Interfacce

- **Team** (`/spazio`): nuove schede Cabina di regia, Produzione, Studio e Le mie vendite; sezione «AI, costi e revisioni» in Impostazioni CRM. Le schede compaiono solo con i permessi necessari, e i permessi li verifica comunque il server.
- **Cliente** (`/area-autore`): nel dettaglio del progetto, il riquadro «Il tuo testo» con lettura, osservazioni, proposte di modifica, richiesta di revisione, cicli e download.
- Identità visiva: avorio, blu notte, corallo per le proposte. Nessun menu duplicato.
