# Analytics e conversioni

## Due mondi, e la distinzione conta

Gli eventi di conversione vivono in due posti diversi, e confonderli è il modo
più comune di misurare male una campagna.

**Eventi di navigazione.** Succedono nel browser: un preventivo generato, un
checkout aperto, un clic su «prenota una call». Finiscono nel `dataLayer` di
Google Tag Manager, da cui Google Ads, GA4 e Meta li leggono senza bisogno di un
rilascio.

**Eventi di esito.** Succedono sul server, spesso giorni dopo, e quasi sempre
senza nessun browser aperto: un lead qualificato da un operatore, una proposta
inviata, un ordine pagato per bonifico. Il `dataLayer` non li vedrà mai.

Farli scattare con un pixel sarebbe possibile solo mentendo: bisognerebbe
sparare `purchase` quando il cliente torna sulla pagina di ringraziamento — cioè
misurare *il ritorno alla pagina* invece dell'incasso. Si perderebbe ogni
bonifico, ogni pagamento fatto da un altro dispositivo, ogni scheda chiusa
subito dopo il pagamento. Perciò gli eventi di esito si registrano lato server
in `conversions`, con la loro attribuzione, e si caricano su Google Ads come
**conversioni offline**.

| Evento | Dove nasce |
| --- | --- |
| `lead_created`, `quote_started`, `quote_generated`, `consultation_clicked`, `checkout_started`, `manuscript_analysis_completed` | browser → dataLayer |
| `qualified_lead`, `proposal_sent`, `client_won`, `purchase` | server → tabella `conversions` |

## Il funnel misurato è il funnel reale

Gli eventi di esito **non** si emettono con chiamate sparse: nascono dal cambio
di stato del lead (`EVENTO_PER_STATO_LEAD`) e dall'incasso di una rata. Non si
può segnare `client_won` senza che il lead sia diventato cliente, perché è la
transizione a emetterlo — e la macchina a stati della pipeline non permette di
saltare gli stadi intermedi.

`purchase` scatta su **ogni** incasso, non solo su quelli di Stripe: un bonifico
è una vendita quanto una carta, e misurarne solo una metà darebbe alle campagne
un'immagine sistematicamente sbagliata del ritorno.

## Deduplicazione

`chiaveDedup` è costruita sul fatto, non sul momento: `lead-<id>-<evento>`,
`pagamento-<id>-purchase`. Un webhook riconsegnato, un operatore che rifà un
passaggio, un lead che torna indietro e riavanza non contano due volte.

## Attribuzione congelata

L'attribuzione (`gclid`, `utm*`, landing) viene copiata nella conversione **al
momento in cui avviene**. Il `gclid` di un lead può essere sovrascritto da una
visita successiva, e un'attribuzione che cambia dopo il fatto rende le campagne
illeggibili. Nella conversione finiscono solo i campi di attribuzione: mai
email, nome o telefono.

## Nessun valore inventato

`HA_VALORE` dice quali eventi portano un importo. Un evento senza valore reale
non ne riceve uno finto — nemmeno se il chiamante ne passa uno, perché
`registraConversione` lo scarta. Google ottimizza su questi numeri: un valore
inventato insegna alla campagna a comprare il pubblico sbagliato, e il danno si
vede mesi dopo attribuito a tutt'altro.

## Nessun dato personale nel dataLayer

`payloadDataLayer` scarta ogni parametro il cui nome somiglia a un campo
identificante (email, nome, telefono, codice fiscale…). Il `dataLayer` è
leggibile da qualunque script sulla pagina, comprese le estensioni del browser:
un'email che passa di lì è un'email uscita dal nostro controllo.

## Consegna a Google Ads

`GoogleAdsOffline` carica le conversioni con `uploadClickConversions`. Due
regole:

- **senza `gclid` non si manda**: Google non saprebbe a quale clic attribuire la
  conversione e la scarterebbe. Resta registrata da noi, perché il funnel
  interno non dipende da Google;
- **senza un'azione di conversione configurata per quell'evento non si manda**:
  la mappa evento→azione sta in `GOOGLE_ADS_AZIONI`, in configurazione e non in
  codice, perché quegli identificativi cambiano quando qualcuno tocca l'account
  pubblicitario.

Senza credenziali il provider è spento: le conversioni restano registrate e non
inviate, e il cruscotto lo dice. Meglio un numero che dichiara «non consegnato»
di uno che finge di esserlo.

# White label

## Un'agenzia è un tenant

Ogni agenzia è una riga in `organizations` con `tipo = 'agenzia'`. Non vede i
dati di un'altra agenzia, e non sa che le altre esistano: `elencaAgenzie`
risponde con un rifiuto a chi non è lo studio, non con un elenco filtrato — non
esiste una versione «vedi le altre, ma meno».

Il `super_admin` di un'agenzia è super_admin **della sua agenzia**: il ruolo non
attraversa il tenant, e un test di integrazione lo verifica.

## Il branding è un confine di sicurezza

`lib/branding.ts` è il punto in cui dati scritti da un'agenzia diventano CSS e
markup nella pagina di un suo cliente.

- **Un colore dev'essere un colore.** Un valore arbitrario permette di chiudere
  la regola e aprirne altre. Solo esadecimali a 3, 6 o 8 cifre.
- **Le variabili si passano come oggetto di stile, non come `<style>`.** React
  le scrive con `setProperty`, che rifiuta i valori malformati e non può
  chiudere una regola; un `<style>` costruito per concatenazione avrebbe
  richiesto di rendere sicuro anche il selettore, e ogni pezzo concatenato è un
  pezzo che si può sbagliare.
- **Un logo dev'essere https**, senza credenziali nell'URL: un logo servito in
  chiaro o da un dominio qualunque fa tracciare i clienti da terzi a ogni
  caricamento.
- **`brandingValido` restituisce l'oggetto ripulito**, non l'input con accanto
  una promessa: in database finisce solo ciò che è passato dai controlli.
- `variabiliStile` **ricontrolla** anche ciò che è già validato. È l'ultima riga
  prima che una stringa diventi CSS, e una riga di ricontrollo non costa nulla.

## Marchio invisibile

Con `proemiosInvisibile` il nome Proemios non compare in niente di ciò che
l'agenzia vede o inoltra — titoli di pagina, oggetti di email, piè di pagina.
`nomeVisibile` restituisce stringa vuota invece di ripiegare sul nostro nome: è
la promessa commerciale del white label, e vale anche nei posti che sembrano
innocui.

## Verifica

`tests/branding.test.ts` (14) e `tests/conversioni.test.ts` (14) sono unitari.
`tests/integrazione/agenzie.test.ts` (20) gira su Postgres e prova che
un'agenzia non elenchi le altre, non ne cambi il branding, non ne veda le
conversioni; che il funnel di un tenant contenga solo il suo; e che il cambio di
stato di un lead emetta la conversione con l'attribuzione congelata e senza dati
personali.
