# Proemios - modello commerciale e funnel operativo (bozza da validare sui contratti)

> **Origine e limiti.** Questa specifica deriva dal catalogo, motore prezzi e candidato PR #15. La cartella contratti comunicata dal titolare restituisce 404 dal Drive collegato e la pagina privata AddLance richiede autenticazione: **nessuna cifra qui sotto e una media storica di contratti firmati**. Validare prezzi effettivi, margini, scadenze e clausole prima di usarli per forecast o automatismi legali.

## Modello
Proemios opera come *studio editoriale con piattaforma operativa*, in tre flussi commerciali:
1. **Self-service online** (servizio standard e scope deterministico): acquisto autonomo solo con offerta, termini, imposte, capacità e sicurezza verificati.
2. **Inside sales** (due venditori): progetti che richiedono diagnosi, call, revisione della proposta o budget consistente.
3. **Partner / referral / B2B**: acquisizione tramite agenzie e affiliati; policy commissioni approvata e dedup delle attribuzioni.

Il cliente vede risultato, tempi, file, approvazioni e pagamenti; non vede tecnologie AI, costi interni o log. Redazione e operations subentrano dopo conferma d'ordine, con autorizzazioni separate.

## Routing: fatto nel codice
In entrambi i moduli pubblici (preventivo e contatto/agenzie), a transazione aperta, il lead viene assegnato automaticamente al venditore **attivo e con email verificata** che ha meno lead ancora aperti. Il lock transazionale evita due assegnazioni concorrenti sbilanciate. Se non esiste alcun venditore idoneo, il lead rimane nella coda amministrativa e non viene attribuito a utenti inventati. Le proposte generate online rimangono collegate allo stesso lead. Gli inserimenti manuali già assegnati al creatore non vengono riassegnati.

Prima di usare Ads, aggiungere: notifica personale al venditore, SLA misurato, indisponibilità/turni, fallback/reassignment automatico, duplicati cross-channel, dashboard 'senza proprietario' e routing basato su disponibilità reale (non solo sul numero di lead).

## Regole del funnel
| Fase | Responsabile | Obiettivo verificabile |
| --- | --- | --- |
| Annuncio/SEO/outbound/AddLance/partner | Marketing / seller | Visitatore e attribution dove lecito |
| Preventivo / form / analisi / referral | Piattaforma | Contatto registrato una sola volta, consenso e fonte |
| Smistamento | Motore | Proprietario venditore o coda admin, data di assegnazione |
| Primo contatto | Seller | SLA iniziale proposto: entro 15 minuti in orario lavorativo, altrimenti al primo turno |
| Qualifica | Seller | Servizio/progetto, stato materiali, parole, obiettivo, scadenza, investimento, decisore |
| Call / diagnosi | Seller | Bisogno e scope verificati; indicazione di percorso |
| Proposta | Seller | PDF/versione, inclusioni/esclusioni, scadenza, IVA, acconto, responsabilità |
| Follow-up | Seller | Prossima attività con data; nessun lead in stallo |
| Accettazione e pagamento | Cliente + sistema | Offerta accettata, pagamento riconciliato via webhook |
| Handoff | Operations | Project owner, brief, file, milestone, redazione assegnata |
| Produzione e delivery | Editor + operations | Approvazione umana, deliverable, saldo e consegna |
| Upsell / referral | Sales | Nuova proposta solo se coerente con il bisogno |

Stage CRM di PR15: new, contacted, qualified, proposal, won, lost. La call e il follow-up sono attività/tappe, non nuovi stage inventati; reason obbligatorio alla perdita.

## Classificazione commerciale
**A - Self-service abilitabile**, previa verifica: correzione bozze su manoscritto completo, impaginazione semplice, EPUB, copertina con brief standard, scheda Amazon e assistenza KDP/ISBN; prezzo calcolato server-side, controllo file e capacità prima dell'incasso. I tre pacchetti preesistenti NON equivalgono a listini per singolo servizio: vanno offerte configurazioni appropriate senza bundle forzati.

**B - Inside sales**: editing strutturale, memoir, ghostwriting, co-writing, da materiali grezzi al libro, libro professionale, ricerca storica/archivistica, traduzioni specialistiche, progetti urgenti o atipici. Prima raccolta materiali leggera; preventivo vincolante solo dopo assessment.

**C - B2B**: agenzie, case editrici, service, white-label e volumi ricorrenti. Contratto quadro con SLA, riservatezza, pagamento e proprietà dei deliverable. Mai checkout consumer standard.

Non automatizzare un pagamento quando il prezzo dipende dal giudizio professionale, mancano i termini approvati o non esiste capacità di produzione disponibile.

## Regole per due venditori
- Ogni lead ha **un owner**. Il commerciale non vede manoscritti o lead altrui.
- Inbound: bilanciamento carico già inserito, ma necessarie preferenze (disponibilità, lingua, specializzazione, ferie), notifiche e fallback prima della produzione.
- Attività: primo contatto, tentativo, call, proposta, follow-up e motivazione perdita; l'attività successiva con scadenza è sempre obbligatoria nella disciplina operativa.
- Esempio di follow-up *da verificare contrattualmente/commercialmente*: proposta inviata -> 24h verifica ricezione -> 72h valore/dubbi -> 7d decisione/stato -> nurture. Niente pressione eccessiva né comunicazioni marketing senza base giuridica.
- Commissioni: **nessuna percentuale ipotizzata**. Salvare policy versionata per seller/affiliati; maturazione legata a incassi effettivi IVA esclusa; rettifiche su storni e rimborsi. Non accreditare commissioni a lead auto-acquistati senza regola formalizzata.

## Catalogo e vincoli economici già nel repository
Una sola fonte di verità: `config/pricing.ts`. Minimo progetto 149 EUR, acconto standard 40%, editing/correzione per fasce parole, forfait per servizi di produzione. Questi sono **prezzi di listino del software**, non ricavi medi storici. Per condizioni contrattuali personalizzate, salvare la differenza e autorizzare quote versionate senza riscrivere il listino generale.

## Campagne e landing
- Google Ads Search ad alta intenzione: correzione bozze, editing, ghostwriting, KDP, impaginazione. Ogni gruppo annunci su landing specifica con CTA preventivo o call.
- Meta: storie familiari, memoir e libri di impresa (landing empatiche/educative).
- LinkedIn/outbound: libri professionali e B2B white-label, con call diagnostica.
- AddLance: canale manuale/import CRM di offerte e risposte; non automatizzare scraping o invio su pagine autenticate senza capacità/permessi adeguati.
- Referral/affiliati: link dedicato, attribuzione verificabile, policy e antifrode.

**Misurazione**: source/medium/campaign/click ID con consenso quando richiesto; lead -> qualified -> proposal -> won -> purchase dal database, import conversioni offline deduplicato. Niente ricavi inventati nei pixel e niente PII nei dataLayer.

## Economics da calcolare quando arrivano i contratti reali
Per contratto: data, canale, tipologia, prezzo base, IVA, acconto, saldo, scadenze, lavoro incluso/escluso, revisioni incluse, costo editor, costo AI/storage/pagamenti, rimborso, ore vendita e ore PM, margine lordo e contributivo.

KPI: lead response SLA, lead->qualified, qualified->call, call->proposal, proposal->won, AOV, incassato, tempo chiusura, CAC, MER/ROAS solo dopo attribuzione valida, margine di contribuzione per canale, tasso rimborsi, giorni consegna, riacquisto.

**Priorità go-live**: accessi veri e domini, DB staging/prod + backup/restore, inviti ai due seller, email, storage/scanner, Stripe test-live, IVA e policy commissioni approvate, GDPR/DPA, end-to-end percorso checkout ed editoriale, alert e rollback. Nessun merge in produzione senza questi gate.
