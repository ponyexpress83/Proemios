# Proemios 2.0: collaudo

Data: 18/10/2026. Esiti delle verifiche fatte e scenari da ripetere su staging. **Nessun servizio esterno è stato verificato con il servizio reale.**

## Verifiche eseguite

| Verifica | Esito |
|---|---|
| Typecheck (`tsc --noEmit`) | ok |
| Lint (`eslint`) | ok |
| Test automatici (`vitest run`) | ok: 213 test in 15 file, tra cui i 18 nuovi di `tests/studio.integration.test.ts` |
| Build di produzione (`next build`) | ok |
| Percorso nel browser su Postgres locale con la migrazione 0014 (desktop e telefono) | ok, dettagli sotto |

I test girano su PGlite con le migrazioni reali e l'autenticazione reale (password più TOTP). Stripe, Anthropic, Google e lo scanner sono simulati; la posta finisce in una cartella.

## Scenari richiesti

| Scenario | Coperto da | Stato |
|---|---|---|
| A. Vendita: lead → trattativa → preventivo → contratto → pagamento | `crm.integration.test.ts`, `platform.integration.test.ts`; preparazione di `studio.integration.test.ts` | verificato nei test locali |
| B. Produzione: importazione, AI, controllo umano, consegna | `studio.integration.test.ts` | verificato nei test locali (AI simulata) |
| C. Revisione del cliente: osservazioni, richiesta, decisione, AI mirata, controllo qualità, V2 | `studio.integration.test.ts` | verificato nei test locali |
| D. Provvigioni, incluso il rimborso | `crm.integration.test.ts`, `platform.integration.test.ts` (rimborso e storno); home del venditore in `studio.integration.test.ts` | verificato nei test locali |
| E. Sicurezza: isolamento del cliente, ruoli, nessun segreto in Diagnostica, token Google cifrato | `studio.integration.test.ts`, `crm.integration.test.ts` | verificato nei test locali |
| F. Documenti: DOCX → (Google) → AI → controllo umano → DOCX con revisioni e DOCX pulito | `documents.test.ts`, `studio.integration.test.ts` | verificato nei test locali; apertura in Word **da provare** |
| G. Resilienza | vedi sotto | verificato nei test locali |

Scenario G nel dettaglio:

| Caso | Dove |
|---|---|
| Webhook Stripe duplicati | test esistenti |
| Cron ripetuto | blocco e salto del giornaliero |
| Errore di rete dell'AI | ripresa senza ripetere le porzioni |
| Rifiuti ripetuti del modello | lavorazione fallita con avviso |
| Budget superato | pausa e ripresa autorizzata |
| Pausa globale | rispettata |
| Documento modificato durante l'AI | proposte superate |
| Token Google revocato | collegamento «revocato» |
| Conflitto con Google | nessuna sovrascrittura |
| Salvataggi concorrenti | conflitto di revisione |

## Prova nel browser (Postgres locale, server di produzione locale)

1. Produzione → «Apri nello Studio» → importazione del manoscritto del progetto di prova.
2. Studio: «Avvia» mostra il blocco «AI editoriale non abilitata nell'ambiente», com'è corretto senza le variabili.
3. Proposta di prova (inserita a mano nel database locale, perché l'AI non è attiva) → «Accetta» → nuova revisione.
4. «Approva la revisione» → V1 e V2 consegnate con DOCX e PDF.
5. Cliente: legge «Stai leggendo V2», lascia un'osservazione e invia la richiesta. Il ciclo risulta «da valutare» perché i cicli inclusi non sono indicati, e non parte nessuna lavorazione.
6. Il cliente non vede termini interni (proposte del team, categorie, note).
7. Cabina di regia, Studio e Produzione su telefono: nessuno scorrimento orizzontale.

Dalla prova sono emersi due difetti, corretti:
- alcuni indicatori mostravano codici interni («queued», «verified»): ora sono in italiano;
- il carico degli operatori contava anche i compiti dei clienti: ora li esclude.

Dai test è emerso anche un problema di sicurezza, corretto: un cliente poteva creare un documento di lavoro sul proprio progetto, e ora solo il team può farlo.

## Da ripetere su staging (con credenziali di prova)

1. Applica la migrazione 0014 al database di staging (vedi `PROEMIOS_GO_LIVE.md`) e controlla la Diagnostica.
2. Approva in Impostazioni CRM → AI, costi e revisioni le regole AI con tetti bassi (ad esempio 2 $ per lavorazione e 20 $ al mese), il cambio e i cicli per servizio.
3. Imposta `ANTHROPIC_API_KEY` ed `EDITORIAL_AI_ENABLED=1` **solo su staging**.
4. Con un account cliente di prova acquista con Stripe in modalità test, carica un DOCX sintetico, importalo, avvia una correzione di bozze, controlla proposte, costo e avviso, accetta, esporta il DOCX con revisioni e **aprilo in Word**, poi consegna.
5. Come cliente invia una richiesta di revisione; come responsabile decidila e consegna la V2.
6. Facoltativo: collega Google con un account di prova e prova importazione, sincronizzazione, conflitto e condivisione in commento.
7. Prova l'assistente commerciale su una trattativa di prova (attivandolo nelle regole).
8. **Definitiva prima e dopo il saldo.** Con il solo acconto pagato, «Approva» con «Versione definitiva» e «Consegna al cliente» deve essere rifiutata con il messaggio sul saldo e il cliente non deve ricevere nulla; senza consegna deve riuscire. Paga il saldo con la carta di test: la Definitiva con consegna riesce, il cliente la riceve e il progetto può passare a «consegnato».
