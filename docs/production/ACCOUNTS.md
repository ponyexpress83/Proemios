# Identità, ambiti e verifiche

Nessuna password, token o link d’invito viene consegnato. Nessun account live è attivo con questa modifica.

| Identità reale | Ruolo | Stato | Attivazione |
|---|---|---|---|
| Valerio | Proprietario | Non creato: manca email verificata autorizzata | Registrazione/verifica, PROEMIOS_OWNER_EMAIL protetto una tantum, TOTP, rimuovere env dopo bootstrap |
| Alberto | Editor assegnato | Invito non eseguito: email non disponibile | Invito personale autorizzato dopo provider/staging verificati |
| Altri admin/editor/venditori/affiliati/finance/autori | Come richiesto | Nessuna identità fornita | Ruolo e deleghe approvati prima dell’invito |

| Ruolo testato | Lettura/scrittura consentita | Rifiuto verificato | Ambito |
|---|---|---|---|
| Proprietario sintetico | Bootstrap verificato, policy, persone, inviti, assegnazioni | Nessun accesso staff senza TOTP; auto-rimozione rifiutata | Organizzazione |
| Admin completo sintetico | Preferenze personali; grants editoriali/CRM espliciti | Privilegi non impliciti, nessun owner tramite signup | Grants scelti |
| Admin limitato sintetico | Elenco/creazione CRM | Finanza, progetto altrui, invito owner | CRM organizzazione + proprio profilo autore |
| Editor A/B | Progetto assegnato, messaggi, file/consegna, revisione | Progetto dell’altro editor, inviti senza delega | Assegnato |
| Venditore A/B | Lead proprio, nota e proposta/PDF | Lead/assegnazione altrui, modifica incassi, manoscritti | Assegnato |
| Affiliato A/B | Link/conversioni proprie e preferenze | Conversioni altrui, export CRM, contatti completi | Proprio |
| Finance | Ledger/incassi test e export finanziario | Download manoscritto e pagamento commissione senza permesso dedicato | Finanza organizzazione |
| Autore A/B | Progetti propri, claim, approvazione versione e download | ID di altro autore, note interne, consegna editor, grant staff | Proprio |

Sessioni DB: autore massimo 7 giorni, staff massimo 12 ore, operazioni sensibili richiedono login/TOTP recente entro 15 minuti. Nessuna cookie cache dell’identità; revoca membership elimina sessioni e grants riletti a ogni richiesta. L’abilitazione TOTP revoca le sessioni precedenti. Invito accettato impone nuovo login e MFA.

I test usano vere API Better Auth e database PostgreSQL isolato. Le connessioni esterne sono escluse. Non sono una prova di MFA, mailbox o restore nello staging Vercel. Ambito gruppo non disponibile: richiede gruppi e deleghe definiti; non viene sostituito con organizzazione. Coordinatore resta facoltativo su progetti assegnati.

Better Auth include codici di recupero; conservarli offline dopo l’enrollment e usare la funzione supportata. Recupero amministrativo del proprietario richiede processo di identità approvato e secondo proprietario verificato: nessun bypass o password di emergenza implementato.
