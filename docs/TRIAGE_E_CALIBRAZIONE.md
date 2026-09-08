# Triage e calibrazione

## Il collo di bottiglia non è il modello

Un manoscritto da ottantamila parole produce più di mille interventi. Il modello
li genera in minuti; **una persona che li legge uno per uno ci mette ore**. È lì
che la produzione si ferma, ed è lì che conviene intervenire — non
automatizzando la consegna, che è già veloce e non deve diventare automatica.

## Il triage è calcolo, non un modello

Quarantasette occorrenze identiche di «acuqa → acqua» sono **una decisione
sola**, e per accorgersene basta confrontare due stringhe. Nessuna chiamata a un
modello, nessun costo, nessuna possibilità che un agente inventi una somiglianza
che non c'è.

`lib/produzione/triage.ts` raggruppa in tre modi:

| Tipo         | Quando                                                | Esempio                                             |
| ------------ | ----------------------------------------------------- | --------------------------------------------------- |
| `identico`   | Stessa categoria, stesso `prima`, stesso `dopo`       | «acuqa» → «acqua», 47 volte                         |
| `ricorrente` | Stessa categoria, stessa **regola** su parole diverse | «tornato , ma» e «detto , poi»: entrambe spaziatura |
| `singolo`    | Tutto il resto                                        | un intervento di stile                              |

Le regole riconosciute sono deterministiche: spaziatura, apostrofi e virgolette,
accenti e maiuscole, punteggiatura, e la combinazione delle prime due. Quando la
trasformazione non rientra in nessuna, `regolaRiconosciuta` restituisce `null` e
l'intervento **resta singolo**: inventare una somiglianza è peggio che non
trovarla.

Sotto le tre occorrenze una regola non diventa un gruppo. Un "gruppo" da due
voci non fa risparmiare niente e nasconde due decisioni dietro un clic.

## Quanto fa risparmiare, davvero

Sul corpus di prova il fattore è 965×, ma è un artefatto: quel manoscritto
ripete quattro difetti. Su una distribuzione realistica — difetti meccanici
ripetuti più una coda lunga di grammatica, sintassi e stile tutti diversi — il
fattore misurato è **circa 4×**.

Il numero che conta non è quello, però: è la **forma**. Su 685 interventi, 590
(l'86%) si chiudono in cento decisioni in blocco, e l'attenzione del redattore
va sui 95 che la richiedono davvero. Il triage non fa sparire il lavoro
editoriale: gli toglie di mezzo il rumore.

## Cosa richiede comunque un'occhiata

Un gruppo è marcato `richiedeAttenzione` quando:

- **anche una sola** voce sta sotto `SOGLIA_ATTENZIONE` (0,7, la stessa soglia
  con cui il motore riclassifica un intervento come dubbio) — una media che
  nasconde un dubbio è peggio di nessuna media;
- la categoria è editoriale: sintassi, stile, dubbio. Lì la correzione entra
  nella voce dell'autore, e nessuna confidenza rende quella decisione meccanica.

L'ordine di lavorazione mette le categorie meccaniche per prime: si smaltiscono
in blocco e liberano attenzione per ciò che la richiede.

## La calibrazione dice quando allentare

Senza una misura, la decisione di automatizzare una categoria resta una
sensazione: o non si allenta mai per prudenza, o si allenta tutto dopo una
settimana fortunata.

I dati esistevano già — `editorial_interventions` conserva sia la proposta sia
la decisione della persona — e bastava guardarci.

**La distinzione che regge tutto** è fra due modi di non essere d'accordo:

- `rejected`: il modello ha proposto una correzione dove non serviva. Errore
  pieno.
- `modified`: il modello ha trovato il punto giusto e ha sbagliato le parole.
  **Successo parziale.** Contarlo come un errore sottostima il modello in modo
  grossolano: su un editing, «hai visto il problema ma l'hai risolto male» vale
  molto più di «non hai visto niente».

Da qui due numeri per categoria: **accordo pieno** (accettato senza toccare una
parola) e **accordo sul punto** (accettato o modificato).

## La raccomandazione è conservativa di proposito

`raccomandazione()` propone di allentare solo con **accordo pieno ≥ 98% su
almeno 100 decisioni**. Il 95% sembra alto e non lo è: è un errore ogni venti,
cioè decine di correzioni sbagliate su un manoscritto.

Con meno di cento decisioni la pagina dichiara il campione insufficiente invece
di mostrare una percentuale che sembra un risultato. È una difesa contro la
tentazione di allentare dopo dieci casi andati bene.

E propone: non esegue. Allentare un controllo resta una decisione di una
persona, che deve poterla scrivere in un verbale.

## Le fasce di confidenza

Se il modello è calibrato bene, l'accordo scende insieme alla confidenza
dichiarata. **Se non scende, la confidenza non sta misurando niente** — ed è
un'informazione importante quanto l'accordo stesso, perché tutto il sistema di
attenzione si regge su quella soglia.

Il confine basso è lo stesso del motore (0,7): misurare con un confine diverso
da quello che governa il comportamento darebbe numeri incomparabili con ciò che
succede.

## Cosa non si allenta mai

La consegna al cliente, qualunque cosa dicano questi numeri. Non è un cancello
di fiducia — non esiste una quantità di prove che lo renda superfluo — è un
cancello di posta in gioco, e toglierlo cambierebbe il prodotto.

## Verifica

`tests/triage.test.ts` (21) e `tests/calibrazione.test.ts` (13) sono puri.
Coprono fra l'altro: che nessun intervento venga perso o finisca in due gruppi,
che le categorie non si mescolino, che una regola non venga inventata dove non
c'è, e che la soglia di attenzione resti allineata a quella del motore.

`tests/integrazione/consegna.test.ts` verifica la calibrazione su Postgres: che
si calcoli dalle decisioni già registrate, che il redattore non la veda, e che
non mescoli due tenant.
