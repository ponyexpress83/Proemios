# Dati necessari, raccolti in una sola scheda

Il candidato non richiede password in chat. Configurare chiavi e connessioni solo nei canali protetti dei provider.

| Input | Azione necessaria | Funzione bloccata |
|---|---|---|
| Email verificata Valerio, email Alberto, destinatari e deleghe autorizzati | Confermare identità e istruzione esplicita all’invito; non usare email inventate | Account reali, owner bootstrap, inviti |
| Postgres separato staging/prod e backup del piano acquistato | Collegare DB, regione, pool/TLS, restore e permessi minimi; applicare migrazioni additive | Tutte le operazioni persistenti nello staging |
| Resend, mittente/dominio verificati e destinatario interno | Configurare RESEND_API_KEY, EMAIL_FROM, EMAIL_INTERNAL e test controllato | Signup, reset, form e notifiche reali |
| Blob privato e scanner | Confermare accesso private, regione, costi, contratto scanner e test sicuro/errore | Manoscritti e PDF/DOCX; TXT è alternativa controllata |
| Anthropic e analisi gratuita | Approvare provider/modello, trattamento/regione, limiti giornalieri per account/globali, budget, tempi di conservazione | Analisi e sua promozione pubblica |
| Stripe modalità test/prod e webhook | Collegare account corretto e secret, provare firma, async e replay nel test mode | Checkout e riconciliazione reale |
| IVA, termini, validità proposta, acconto/saldo, storni | Approvare policy versionata e modalità fiscale, senza copiare fixture | Accettazione economica, pagamenti, documenti |
| Commissioni venditore/affiliato | Approvare percentuali, base, durata attribuzione, casi rimborso/disputa, doppia attribuzione e processo liquidazione | Commissioni e liquidazioni live; nessun 15% demo |
| Identità legale, indirizzi operativi e referente privacy/supporto | Confermare config/legal.ts e TODO di config/brand.ts, informative fornitori e SLA | Pubblicazione del sito operativo |
| Domini e autorizzazione al rilascio | Verificare titolarità/DNS/HTTPS di proemios.it e approvare solo dopo gate superati | Lancio; DNS non cambiati |
| Foto/biografie/testimonianze/casi reali | Fornire materiali autorizzati e prove dei risultati | Pubblicazione di quelle sezioni |
| Cron, alert, conservazione per categoria e backup storage | Confermare piano/cadenza, eseguire cron, alert destinatario e restore completo | Certificazione operativa e privacy |
| Gruppi organizzativi e processo rimborsi/pagamenti | Definire membership/delega, separazione preparatore/autorizzatore/esecutore | Ambito gruppo, esecuzione rimborsi e bonifici |
| Caso originale differenza 50 € | Fornire scelte del configuratore e listino di riferimento | Riproduzione esatta del segnalato |

Configurazioni commerciali si salvano nello spazio proprietario come policy versionate. Non si inseriscono percentuali/IVA dalla demo. Nessuna funzione opzionale è dichiarata pronta in assenza di collegamento e prova.
