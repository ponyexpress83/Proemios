# Motore DOCX — revisioni tracciate

Il documento che il cliente riceve è **il suo file**, con dentro le correzioni
come revisioni di Word. Non è un file nuovo che assomiglia al suo.

La differenza non è stilistica. Un manoscritto arriva con stili di capitolo,
note a piè di pagina, interruzioni di sezione, immagini, campi, a volte
revisioni di altri lettori. Ricostruirlo dal testo estratto — `DOCX → testo →
nuovo DOCX` — significa restituire all'autore un documento che ha perso anni di
impaginazione. Perciò il motore non ricostruisce niente: apre il pacchetto,
innesta gli elementi nelle posizioni esatte di `word/document.xml`, e richiude.
Ogni parte che non viene toccata resta identica byte per byte, perché nessuno la
riscrive.

## I moduli

| File | Responsabilità |
| --- | --- |
| `lib/docx/pacchetto.ts` | Apre e richiude lo ZIP. Le parti non modificate sono ricopiate senza passare da un serializzatore. |
| `lib/docx/ooxml.ts` | Legge paragrafi e run dalla stringa XML, con gli offset assoluti di ciascuno. Non costruisce un albero. |
| `lib/docx/revisioni.ts` | Scrive `<w:ins>` e `<w:del>` dentro l'XML esistente. |
| `lib/docx/commenti.ts` | Aggiunge `word/comments.xml`, il content type e la relazione. |
| `lib/docx/motore.ts` | Orchestrazione: verifica gli interventi, applica, riporta cosa è stato saltato. |
| `lib/docx/revisioni-simulazione.ts` | Simula «accetta tutte» e «rifiuta tutte». Serve ai test, non alla produzione. |
| `lib/produzione/documento.ts` | Dagli interventi decisi in database alla nuova versione di file. |

## Perché stringhe e non un parser XML

Un parser costruisce un albero e poi lo riserializza. La riserializzazione
riscrive **tutto** il documento secondo le proprie convenzioni: ordine degli
attributi, prefissi dei namespace, spazi bianchi, self-closing. Word accetta
quasi sempre il risultato, ma «quasi sempre» su un manoscritto di un cliente
non è una garanzia sufficiente, e le differenze sono invisibili finché non è
troppo tardi.

Il costo di questa scelta è che gli offset diventano una responsabilità del
codice, non della libreria. Il motore la paga in due modi:

1. **Si lavora dal fondo verso l'inizio.** Ogni innesto cambia la lunghezza
   della stringa; procedendo dall'inizio, ogni posizione successiva sarebbe
   sbagliata. Vale sia fra paragrafi che dentro un paragrafo.
2. **Ogni run si riscrive una volta sola.** Tutti gli interventi che cadono
   nella stessa `<w:r>` vengono composti insieme e scritti in un unico
   rimpiazzo. Riscriverla due volte significherebbe, la seconda volta, tagliare
   un intervallo di byte che nel frattempo ha cambiato lunghezza: il risultato è
   XML troncato a metà di un tag, e un documento che Word chiede di riparare.

Il secondo punto non è teorico: è un difetto che il motore ha avuto, scoperto
non da un test unitario ma da LibreOffice, che si è rifiutato di aprire il
documento generato dal manoscritto da ottantamila parole. I test unitari non lo
vedevano perché nessuno metteva due correzioni nella stessa run. Ora c'è
`tests/docx-revisioni.test.ts › più interventi nella stessa run`, che valida
l'XML con `fast-xml-parser` — un lettore che non condivide le assunzioni di chi
ha scritto la stringa.

## Cosa il motore rifiuta di fare

Un intervento che non si può applicare **in sicurezza** viene saltato con un
motivo, e il documento nasce in stato `needs_review`. Un intervento in meno vale
più di un documento da riparare.

Si salta quando:

- il testo in quella posizione non è più quello approvato (il documento è
  cambiato fra l'analisi e la consegna);
- l'intervento attraversa run con formattazione diversa — decidere quale stile
  dare al testo inserito è una scelta editoriale, non tecnica;
- due interventi si contendono le stesse parole;
- l'ancora non è riconducibile a una posizione reale.

## Il percorso completo

```
originale.docx  ──►  estrazione  ──►  segmentazione  ──►  modello
                                                            │
                                              interventi proposti
                                                            │
                                      banco di revisione (/redazione)
                                       accetta · modifica · rifiuta
                                                            │
                                          approvazione editoriale
                                                            │
              originale.docx ──►  generaDocumentoRevisionato  ──► revisionata.docx
                                                            │
                                       approvazione operativa (altra persona)
                                                            │
                                                        consegna
```

L'approvazione editoriale genera il documento **prima** di cambiare lo stato del
Job: se la generazione fallisce, il Job resta in revisione, invece di risultare
approvato con dentro un allegato che non esiste.

Il redattore che approva editorialmente non consegna. La consegna richiede
`progetto.approva_consegna` e poi `progetto.consegna_al_cliente`, e la macchina
a stati non ha una transizione che salti nessuno dei due passaggi. Chi ha
approvato editorialmente non può approvare la consegna dello stesso Job nemmeno
se ha entrambi i permessi: la separazione è sulla persona, non sul ruolo
(`tests/integrazione/consegna.test.ts`).

## Verifica

| Comando | Cosa prova |
| --- | --- |
| `npx vitest run tests/docx-*.test.ts` | Struttura, scala (1932 interventi), accetta/rifiuta, XML ben formato secondo un parser di terze parti. |
| `npm run docx:verifica` | Apre i documenti generati con **LibreOffice**. È la verifica più vicina a «Word li apre senza chiedere di ripararli» che si possa fare senza Word. |
| `npm run test:integrazione` | Il percorso completo su Postgres e storage veri: l'originale resta intatto, la versione nuova è legata al Job, i confini di ruolo tengono. |

Il corpus (`tests/corpus/`) è generato da `scripts/corpus-docx.py` con
`python-docx`: documenti Word veri, non finti, compreso un manoscritto da
ottantaduemila parole.
