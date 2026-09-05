# Commercio: ordini, incassi, fatture

## Il principio che regge tutto

**Nessun importo attraversa il browser.**

Le funzioni che aprono un pagamento ricevono l'id della rata, mai una cifra.
L'importo viene letto dall'ordine, che a sua volta nasce da un preventivo
approvato. Se un giorno una di queste firme acquistasse un parametro
`importoCent`, quello sarebbe il punto esatto in cui il prezzo diventa
scegliebile da chi paga — perciò non c'è, e i test lo verificano.

Lo stesso vale per il webhook: il payload di Stripe dice **quale** rata è stata
pagata, non quanto. L'importo resta quello in database.

## Gli importi sono interi

Tutto è in **centesimi interi**. `0.1 + 0.2` non fa `0.3`, e su una rata
calcolata in percentuale quella differenza arriva in fattura. I decimali
compaiono in due soli punti: la formattazione per lo schermo
(`euroDaCentesimi`) e il confine con Fatture in Cloud, che vuole euro.

`lib/commercio/piano.ts` è puro e interamente testato. La proprietà che difende:
**la somma delle rate è esattamente il totale**, su qualunque importo. Il 40% e
il 60% di 33,33 € arrotondati non ci arrivano da soli, quindi l'ultima rata
assorbe la differenza — la convenzione contabile normale, ed è quella che il
cliente si aspetta di vedere.

Un piano personalizzato che non quadra **non si aggiusta**: è un errore di chi
lo ha scritto, e va corretto prima di andare al cliente.

## L'acconto

`DEPOSIT_RATE` sta in `config/pricing.ts` e vale 0,4. Non è stato cambiato e non
si cambia da qui: è una decisione commerciale già presa. `ACCONTO_PUNTI_BASE` lo
legge e lo converte in punti base; un test verifica che i due restino allineati.

## Modalità di pagamento

| Modalità | Rate |
| --- | --- |
| `acconto_saldo` | Acconto alla conferma, saldo alla consegna. Predefinita. |
| `milestone` | Acconto, poi una rata per tappa, con quote in punti base che devono sommare a 10000. |
| `unica` | Una rata sola. |
| `personalizzato` | Rate scritte a mano, che devono quadrare sul totale. |

## Il ciclo

```
preventivo approvato
      │
      ▼
   ordine (bozza) ── contratto (bozza → inviato → firmato)
      │
      ▼  confermaOrdine
   in_attesa_pagamento
      │
      ▼  primo incasso (Stripe o bonifico registrato)
   confermato ──► produzione ──► consegna
```

Basta l'acconto per far partire il lavoro: aspettare il saldo per cominciare
significherebbe non cominciare mai.

## Idempotenza

Stripe riconsegna gli eventi, e li consegna anche fuori ordine. Ogni operazione
è scrivibile più volte con lo stesso esito:

- `segnaIncassata` aggiorna solo le rate ancora `in_attesa` e dice se ha
  davvero cambiato qualcosa: la seconda consegna dello stesso evento non trova
  nulla da aggiornare;
- `sincronizzaRimborsoStripe` **assegna** il totale rimborsato che Stripe
  comunica, non lo somma;
- `apriPagamento` usa una `idempotencyKey` per rata: un doppio clic non apre
  due sessioni;
- un evento sconosciuto risponde 200, non 500 — un 500 farebbe riprovare Stripe
  all'infinito su qualcosa che non ci interessa.

Il vecchio flusso dell'acconto pagato dalla pagina pubblica del preventivo
convive sullo stesso endpoint: i due si distinguono dai metadati, non dal tipo
di evento, così se ne può togliere uno senza toccare l'altro.

## Rimborsi

Un rimborso **non cancella l'incasso: lo riduce**. `importoRimborsatoCent`
cresce e la rata diventa `rimborsato` solo quando è stata restituita per intero;
un rimborso parziale lascia la rata `pagato`, che è la rappresentazione corretta
di ciò che è successo. Il residuo dell'ordine si riapre di conseguenza.

L'ordine delle operazioni è deliberato: **prima si rimborsa su Stripe, poi lo si
registra**. Scriverlo prima significherebbe avere in contabilità un rimborso che
la banca non ha mai fatto — un errore che si scopre quando il cliente richiama.

## Fatture

Proemios **non emette** il documento fiscale: lo fa Fatture in Cloud, che
conosce numerazione, SDI ed esterometro. Qui vive l'adattatore, e il database
conserva il riferimento a ciò che è stato emesso, non una seconda copia.

Il rischio da governare è il doppione — una fattura emessa due volte è un
problema fiscale — e la difesa è in tre strati:

1. la riga passa per `in_emissione` prima della chiamata, e la transizione
   avviene solo se era `da_emettere`: due richieste contemporanee non entrano
   entrambe;
2. una riga già `emessa` non si riemette mai;
3. un errore **non ritentabile** (4xx sui dati) la ferma in `errore`, mentre uno
   di rete o un 5xx la riporta in coda. Riprovare con gli stessi dati non
   risolve un rifiuto, e rischia un doppione.

Senza credenziali il provider è `manuale`: non emette e lo dichiara. Un prodotto
che finge di aver emesso una fattura è peggio di uno che dice di non poterlo
fare.

## Contratti

Il testo si **congela all'invio**. Un contratto che rimanda a un modello vivo
cambia insieme al modello, e fra sei mesi nessuno sa più cosa il cliente avesse
davanti. Una modifica dopo l'invio è una versione nuova, non una riscrittura.

L'accettazione è una conferma tracciata, non una firma elettronica qualificata,
e l'interfaccia lo dice. Solo il cliente proprietario può accettare: accettare
per conto di qualcun altro non è un permesso che esiste.

## Comunicazione

**Notifiche.** `lib/notifiche/tipi.ts` è il catalogo: ogni tipo dichiara testo e
rotta, e la rotta è sempre interna — una notifica che porta fuori dal prodotto è
phishing con il nostro nome sopra. I testi destinati al cliente non nominano la
lavorazione interna (job, interventi, modelli, stati tecnici), e un test lo
verifica parola per parola. L'email parte solo per ciò che merita di
interrompere qualcuno: una consegna sì, un messaggio in una conversazione già
aperta no.

**Email.** Restano chiare anche se il prodotto è scuro: molti client di posta
ricolorano o invertono i fondali scuri, e il risultato è testo grigio su grigio
in metà delle caselle. L'identità arriva dagli accenti viola, che sopravvivono a
quel trattamento.

**WhatsApp.** Due modi distinti: `linkConversazione` costruisce un `wa.me` che
apre WhatsApp su chi clicca (nessun invio, nessuna credenziale), mentre
`ProviderWhatsApp` manda davvero tramite la Cloud API — solo **template
approvati** da Meta, perché un messaggio libero a chi non ha scritto per primo
viene rifiutato. Senza credenziali il provider è spento e dichiara di non poter
mandare.

**Calendario.** Un URL di prenotazione esterno, con i dati che già conosciamo
precompilati. Deve essere `https`: nome ed email viaggiano in query string.
Senza configurazione restituisce `null`, non un link rotto.

## Verifica

`tests/piano-pagamenti.test.ts` (19), `tests/fatturazione.test.ts` (10),
`tests/notifiche.test.ts` (7), `tests/comunicazione.test.ts` (14) sono unitari e
puri.

`tests/integrazione/commercio.test.ts` (23) gira su PostgreSQL vero e prova ciò
che un mock non potrebbe: che il webhook consegnato due volte produca un solo
incasso, che un rimborso riapra il dovuto, che il cliente non veda gli ordini di
un altro cliente né gli identificativi Stripe dei propri, e che la stessa
fattura non venga emessa due volte.
