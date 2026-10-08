# Checklist di rilascio — BLOCCATO

| Gate | Evidenza attuale | Stato |
|---|---|---|
| Account personali, MFA, deleghe | API Better Auth reali e PostgreSQL isolato; 28 prove integrazione | Locale provato, staging/provider da provare |
| Isolamento manoscritti/API/export | Due autori/editor/seller/affiliate e finance; ID altrui negati | Locale provato; browser autenticato su staging assente |
| DB e Blob persistenti | Migrazioni/restore DB test; TXT privato isolato | Servizi reali e backup file bloccati |
| Form/mail/analisi | Form/outbox durevoli e errori controllati, analisi gated | Mailbox/provider/quote/costi/regioni bloccati |
| Prezzi, pagamenti e commissioni | Motore condiviso, snapshot, asincrono/replay/refund test | Policy commerciali e Stripe test bloccati |
| Dati legali/team/contatti | Nessun caso studio inventato; brand ha TODO | Approvazioni mancanti |
| Dominio HTTPS/crawler | Proemios.it canonical; preview noindex | Dominio non associato, DNS e lancio non autorizzati |
| Monitoraggio/restore/cron | Vista ops, retry, cleanup/restore test | Alert, piano e scheduler live non verificati |
| Test e front-end completo | Typecheck/lint/102 test/build locale | Sei viewport, axe/Lighthouse e percorsi completi ancora da evidenziare |

Non impostare PROEMIOS_PRODUCTION_READY=1 né promuovere finché ogni gate non ha evidenza attuale. Una funzione critica mancante blocca il lancio. Una funzione facoltativa rinviata non compare come operativa.

Nessuna credenziale test configurata sulla preview; i suoi endpoint dipendenti devono rispondere indisponibile e gli spazi privati devono richiedere identità. La preview prova design e fallback, non la piattaforma con account reali. Link effettivo e SHA vengono registrati nella PR e in evidence/deployment.json dopo build remoto riuscito. I link temporanei protetti non sono salvati.

Limiti ancora da verificare oltre ai provider: ambito gruppo; applicazione filtri salvati; revisione proposta nel percorso UI; export/cancellazione privacy completa con referente; processo autorizzazione/esecuzione economica; documenti fiscali; test provider firma webhook/scanner/AI; restore DB+file. Restano nel perimetro, non sono considerati completati.
