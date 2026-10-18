# Proemios 2.0: Document Studio

Data: 18/10/2026. Codice: `lib/platform/documents/` (`service.ts`, `text.ts`, `ooxml.ts`, `revisions.ts`, `production.ts`, `google.ts`, `router.ts`). Interfacce: schede Produzione e Studio in `/spazio` e il riquadro «Il tuo testo» in `/area-autore`.

## Flusso

1. **Caricamento.** Il cliente carica DOCX, PDF o TXT (fino a 4 MB). Lo scanner controlla DOCX e PDF; il TXT UTF-8 passa subito. Il file originale non viene mai modificato.
2. **Importazione.** Dal cruscotto Produzione («Apri nello Studio») chi lavora sul progetto crea il documento di lavoro:
   - il DOCX viene letto paragrafo per paragrafo con gli stili (titoli inclusi);
   - le tabelle non entrano nel testo lavorabile e restano intatte nell'originale;
   - PDF e TXT diventano paragrafi;
   - si creano la revisione 1 e la versione «Originale», che punta al file caricato.
3. **Lavoro.** L'editor accetta, rifiuta o modifica le proposte (singolarmente o tutte le applicabili) e può modificare un paragrafo. Ogni cambiamento è una nuova revisione. Se qualcuno ha salvato nel frattempo, il server risponde «conflitto» e niente si sovrascrive.
4. **Proposte superate.** Ogni proposta è ancorata alla revisione su cui è nata. Se il testo è cambiato, si riposiziona solo quando il tratto originale è ancora riconoscibile in modo univoco; altrimenti viene segnata «superata» e non si applica.
5. **Esportazione.**
   - «DOCX con revisioni» parte dall'originale e scrive revisioni native di Word (`w:ins`/`w:del`, autore e data) solo nei paragrafi cambiati: tabelle, sezioni e paragrafi non toccati restano byte per byte.
   - «DOCX pulito» contiene il testo approvato.
6. **Controllo qualità.** Facoltativo: «Invia al controllo qualità» richiede un responsabile diverso da chi ha lavorato il testo. Durante il controllo consegna solo il responsabile della qualità.
7. **Consegna.** «Approva la revisione N» crea una versione immutabile (V1, V2… o Definitiva) con impronta, DOCX pulito e PDF. I file diventano consegne nell'area del cliente, il ciclo di revisione si chiude e il cliente riceve un avviso in app e per email. La consegna non parte se c'è una lavorazione AI in corso.

## Il cliente

- Legge l'ultima versione consegnata, mai il testo di lavoro.
- Secondo l'accesso scelto dal team (predefinito: «Commenti») lascia osservazioni sui paragrafi e, con «Commenti e proposte», propone modifiche puntuali. Le proposte restano proposte finché l'editor non le accetta.
- Le osservazioni si raccolgono e partono insieme con «Invia richiesta di revisione». Il percorso è descritto in `PROEMIOS_EDITOR_AI.md`.
- Vede i cicli di revisione inclusi e quelli usati, lo stato delle sue richieste in parole semplici e le versioni da scaricare.
- Non vede mai note interne, proposte del team o dell'AI, istruzioni, costi o file di lavoro.

## Formati e compatibilità OOXML

| Verifica | Esito |
|---|---|
| Lettura del DOCX: paragrafi, stili dei titoli, interruzioni, tabulazioni; tabelle escluse | verificato nei test locali |
| Scrittura con revisioni: la vista «accetta tutto» dà il testo nuovo, la vista «rifiuta tutto» dà l'originale | verificato nei test locali (lettura del pacchetto risultante) |
| Corsivo del primo tratto, tabella e `sectPr` conservati | verificato nei test locali |
| Apertura in Microsoft Word e LibreOffice | **non verificata**: LibreOffice non funziona in questo ambiente e Word non è disponibile. Va provata in collaudo su un manoscritto reale anonimizzato |

Limite noto: nei paragrafi modificati la formattazione interna (ad esempio un corsivo a metà frase) segue quella del primo tratto. I paragrafi non modificati conservano tutto.

## Editor collaborativo

L'architettura è neutra rispetto al fornitore (`EditorProvider`). Oggi c'è l'adattatore Google Docs, descritto in `PROEMIOS_INTEGRAZIONI.md`. Il documento Google si condivide col cliente solo in lettura o commento, e le note interne restano in Proemios.

## Verifica

| Voce | Stato |
|---|---|
| Importazione DOCX, permessi, revisioni, conflitti, proposte superate, esportazione con revisioni, consegna, controllo qualità, isolamento del cliente | verificato nei test locali (`tests/studio.integration.test.ts`, `tests/documents.test.ts`) |
| Percorso nel browser su Postgres locale: importazione → proposta → accettazione → V1/V2 con DOCX e PDF → osservazione e richiesta del cliente; desktop e telefono senza scorrimento orizzontale | verificato in locale (Playwright) |
| Staging / produzione | no |
