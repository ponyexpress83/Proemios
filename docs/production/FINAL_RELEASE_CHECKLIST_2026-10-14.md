# Proemios - checklist definitiva del go-live (14 ottobre 2026)

## Cosa implementa questa branch

- Dashboard autore con grafica corallo, avorio e prugna, collegata ai dati reali del database tramite API autorizzate (non sessionStorage).
- Panoramica, progetti con fasi, documenti e revisioni, preventivi con lavorazioni concordate, accettazione esplicita, pagamenti e messaggi per progetto.
- Preventivo con scelta fra una singola lavorazione e un percorso completo di pubblicazione.
- La scelta di un singolo servizio non aggiunge costi o prestazioni editoriali non richieste.
- Staff e partner restano in aree separate, con RBAC verificato lato server.

## Verifica di accesso

- Nell'ambiente staging sono presenti otto utenti temporanei, con mail nel dominio riservato .invalid.
- La verifica in due passaggi resta richiesta sul deployment finche non e abilitata esplicitamente la modalita prevista per lo staging.
- Il flag di test per accesso con sola password NON e attualmente configurato su Vercel e non deve essere descritto come attivo.
- In produzione la 2FA resta obbligatoria per lo staff. Dopo i test, revocare utenti temporanei e creare identita reali con invito verificato e MFA.
- Rigenerare i recovery code e i segreti 2FA eventualmente esposti in screenshot.

## Percorso commerciale da verificare prima di acquisire clienti

1. Landing page -> singolo servizio o percorso completo.
2. Inserimento brief e conteggio parole; proposta coerente col servizio selezionato.
3. Salvataggio preventivo e attribuzione lead ai commerciali.
4. Invio email tramite Resend e collegamento sicuro del preventivo a un autore verificato.
5. Accettazione espressa con condizioni economiche, IVA e versioni contrattuali approvate.
6. Stripe in modalita test: acconto, webhook, riconciliazione; nessun ordine pagato sulla sola redirect.
7. Creazione progetto con la prestazione acquistata, upload documenti, assegnazione operatore ed editor.
8. Revisione umana, approvazione, consegna e saldo.
9. Ordini aggiuntivi, traduzioni, retainer e piani a rate devono essere supportati dai contratti e dal sistema di pagamento; non sono ancora tutti automatizzati.

## Bloccanti attuali

- Resend/EMAIL_FROM non configurati: form pubblico, verifica email e inviti non costituiscono ancora un funnel end-to-end.
- Stripe test e firma webhook non configurati: non promettere una prova di pagamento reale.
- Storage DOCX/PDF privato e compatibilita Word Track Changes da collaudare prima dei manoscritti veri.
- Sessioni autore/staff/affiliate separate a livello di URL e permessi, ma non ancora su realm/cookie host-only distinti.
- Permessi, email verificata, preventivi accettati, isolamento cliente e data retention devono essere verificati con E2E in staging.

## Gate di rilascio

- CI verde, build Vercel READY e verifica diretta browser delle rotte.
- Accesso individuale per autore, owner, due sales, operations, editor, finance e affiliate.
- Prova che seller/affiliate NON possano leggere manoscritti o dati degli altri account.
- Prova su preventivo 'solo correzione bozze' e su pacchetto completo.
- Prova progetto, messaggi, revisione, pagamento test, storno, scadenze e notifica.
- Documenti privacy e condizioni economiche aggiornati, fatturazione integrata se prevista.

## Stato del rilascio

Questa branch e una preview di staging soggetta a controlli, non ancora un via libera alla produzione o agli incassi reali. Il database Neon di staging e separato e si trova nell'UE.