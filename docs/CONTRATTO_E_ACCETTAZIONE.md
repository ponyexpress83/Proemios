# Contratto prima del pagamento: scheda d'ordine, accettazioni, copia stabile, recesso

Comportamento del ramo `claude/proemios-complete-v1-w78xtx`. Tutto quanto descritto è scritto nel codice e verificato nei test di integrazione; "attivo in produzione" dipende dalle configurazioni elencate in `docs/CONSEGNA_2026-10-16.md`.

## Cosa accetta il cliente

Nella pagina `/area-autore/conferma/[id]` il cliente, prima di pagare, vede e può scaricare: la proposta in PDF (`GET quotes/:id/pdf`), la scheda d'ordine (servizio, quantità dichiarate, prestazioni incluse ed escluse, revisioni, consegne, tempi, condizioni di avvio, importi con IVA, acconto e rate) e le condizioni generali con numero di versione (`/termini`, `termsVersion` in `lib/platform/config.ts`).

Le accettazioni sono quattro caselle separate, nessuna preselezionata (`acceptBodySchema` in `lib/platform/crm.ts`):

| Campo | Obbligatoria | Significato |
|---|---|---|
| `termsAccepted` | sì | condizioni generali di contratto e di pagamento, nella versione mostrata |
| `orderSheetAccepted` | sì | verifica della scheda d'ordine (servizio, quantità, importi, tempi, avvio) |
| `earlyStart` | no | richiesta espressa di iniziare durante i 14 giorni di recesso (art. 57 e 59 Codice del Consumo) |
| `marketingConsent` | no | comunicazioni informative facoltative; indipendente dal contratto, revocabile |

## Cosa viene registrato (`platform_contracts`)

- Snapshot strutturato della scheda d'ordine (`order_sheet`, tipo `OrderSheet`), versione della proposta, listino, policy fiscale e versione delle condizioni.
- Impronte SHA-256 della scheda (JSON canonico) e del testo delle condizioni generali (`config/contract-terms.ts`), più l'impronta del PDF archiviato.
- Chi ha accettato (`author_id`), quando (`accepted_at`), da quale indirizzo di rete (`accepted_ip`, primo valore di `x-forwarded-for`) e con quale browser (`accepted_user_agent`, troncato). È una prova proporzionata, non una firma elettronica qualificata: il PDF lo dichiara.
- `consumer`: vero se il profilo di fatturazione non è un'impresa (o non esiste ancora). Per i consumatori viene fissata `withdrawal_deadline` a 14 giorni.
- Audit `quote.accepted` con `contractId`, `earlyStart`, `ip`.

## Copia stabile e supporto durevole

Il PDF del contratto (scheda d'ordine + accettazioni registrate + condizioni generali per esteso) viene generato all'accettazione con `pdf-lib`, salvato nello storage privato (`storePrivate`, Vercel Blob o cartella di test) e inviato via email come allegato (`platform_email_outbox.attachments`, letto dallo storage al momento dell'invio da `flushMail`). Se lo storage non è configurato l'accettazione non si blocca: la copia si rigenera dallo snapshot e l'interfaccia lo dichiara ("copia rigenerata").

Download: `GET /api/platform/contracts/:id/pdf`, consentito a chi può leggere la proposta (autore collegato, venditore assegnato, team). Se l'impronta del file archiviato non coincide con quella registrata la risposta è `409 CONTRACT_COPY_MISMATCH`.

## Condizioni generali versionate

`config/contract-terms.ts` contiene il testo delle condizioni pubblicate il 5 agosto 2026 (`AGGIORNAMENTO_DOCUMENTI`), etichettato `termsVersion = "2026-10-v1"`, stato `approved`. È la copia che entra nel contratto. Per cambiare le condizioni: aggiornare `app/termini/page.tsx` e `config/contract-terms.ts` insieme, cambiare `termsVersion`; i contratti già conclusi restano legati alla versione accettata (impronta e testo nel PDF).

Nessuna clausola nuova viene generata per singolo cliente: la personalizzazione sta nei dati strutturati della scheda d'ordine. I due testi aggiuntivi (`ORDER_SHEET_TEXTS`: avvio anticipato e nota sul recesso) riprendono la sezione "Diritto di recesso del consumatore" già pubblicata e restano **da validare** con il consulente legale prima dell'uso con clienti reali (vedi sotto).

## Recesso online

`POST /api/platform/contracts/:id/withdraw` (solo l'autore del contratto, solo consumatori, entro la scadenza; idempotente). Effetti: data e nota registrate, promemoria del progetto sospesi, email al cliente e al team, notifica al venditore, blocco di nuovi pagamenti (`409 WITHDRAWN` al checkout). Nessun rimborso parte da solo: Finance prepara e un secondo utente con `refund.authorize` autorizza (vedi `docs/FATTURAZIONE_E_PAGAMENTI.md`). Il team chiude la pratica con `POST contracts/:id/withdrawal {outcome}` (`finance.record`).

## Punti da validare con il consulente legale

1. **Qualifica consumatore/impresa** derivata dal profilo di fatturazione (partita IVA = impresa). Un professionista che acquista per fini estranei all'attività è trattato da impresa: decidere se chiedere una dichiarazione esplicita.
2. **Avvio anticipato**: formula di `ORDER_SHEET_TEXTS.earlyStart` (richiesta espressa + riconoscimento della perdita del recesso a servizio completato). Verificare che basti una casella non preselezionata e il testo del PDF.
3. **Servizi personalizzati**: la piattaforma non presume che il servizio escluda il recesso; il recesso resta esercitabile salvo esecuzione completa con consenso. Confermare la scelta.
4. **Modulo di recesso**: la funzione online vale come comunicazione; confermare che la conferma via email al cliente soddisfi l'obbligo di ricevuta su supporto durevole.
5. **Prova dell'accettazione**: IP, user agent, data, utente, impronte. Valutare se serve una firma elettronica avanzata per importi alti.
6. **Cookie e analytics**: vedi `docs/INTEGRAZIONI.md` (bozza di testo per `/cookie` prima di attivare GA4).
7. **Email di recupero** sui pagamenti non conclusi con scopo `cart`: inviate con la sola informativa accettata, in quanto riferite alla richiesta aperta della persona. Confermare l'inquadramento (precontrattuale) o limitarle allo scopo `marketing` con consenso.

## Verifiche in test

`tests/platform.integration.test.ts`: contratto creato all'accettazione (non il progetto), accettazioni e prova registrate, email con allegato, PDF accessibile solo agli autorizzati, piano rate dentro la scheda, recesso online con blocco pagamenti e chiusura da Finance.
