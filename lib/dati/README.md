# Livello dati

Nessuna route, server action o componente accede a `db` direttamente. Tutto
passa da qui, e ogni funzione esige un `Attore` come primo argomento.

Il motivo è che l'autorizzazione, per essere affidabile, deve essere
impossibile da dimenticare. Se una funzione di lettura potesse essere chiamata
senza attore, prima o poi qualcuno la chiamerebbe così — di solito in una
pagina scritta di fretta, di solito quella che poi finisce in produzione.

Ogni funzione fa, in quest'ordine:

1. verifica il **permesso** (`esigiPermesso`);
2. filtra per **tenant** (`organizationId` dell'attore) dentro la query, non
   dopo averla eseguita;
3. verifica la **proprietà** dove serve (un cliente accede alle proprie cose);
4. restituisce un **DTO**, mai una riga di database.

Il punto 2 va fatto *nella clausola WHERE*. Leggere tutto e filtrare in
JavaScript funziona finché qualcuno non aggiunge un `LIMIT`, e a quel punto la
prima pagina di risultati contiene righe di un altro tenant.
