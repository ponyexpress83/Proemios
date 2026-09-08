# DTO

Ogni oggetto che esce dal server verso un'interfaccia passa da qui.

**Regola assoluta: mai `{ ...riga }`.** Uno spread copia anche le colonne
aggiunte domani, e una colonna nuova non deve poter raggiungere il client per
distrazione. Ogni campo è elencato a mano.

I mapper prendono l'attore come primo argomento e costruiscono un oggetto
diverso a seconda del ruolo. Non esiste un DTO "completo" da filtrare dopo:
filtrare dopo significa che l'oggetto completo è esistito, ed è bastato un
`console.log` o un `JSON.stringify` di troppo per farlo uscire.

`tests/dto.test.ts` verifica, campo per campo, che i DTO destinati a un ruolo
non contengano le chiavi che quel ruolo non può vedere.
