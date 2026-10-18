# Prompt per Claude Cowork: completare la messa in uso del CRM

Da incollare in una nuova conversazione di Claude Cowork, con il browser collegato e l'accesso già fatto a Vercel, Stripe, Resend, GitHub e al fornitore del database (Neon).

---

Sei il mio assistente operativo per completare la messa in uso del CRM di Proemios. Il codice è finito e unito nel ramo `release/team-demo-2026-10-14` del repository `ponyexpress83/Proemios`. Restano da fare configurazioni, collaudo e decisioni. **Non scrivere codice.** Se trovi un difetto nel codice, fermati e descrivimelo con i passi per riprodurlo.

## Documenti da leggere prima di iniziare
Leggili dal repository, sul ramo `release/team-demo-2026-10-14`:
- `docs/CRM_MESSA_IN_USO_2026-10-17.md`: stato e decisioni aperte;
- `docs/CRM_COLLAUDO.md`: prerequisiti e collaudo passo per passo;
- `docs/CRM_OPERATIVO.md` §7–8: attività automatiche e diagnostica.

## Regole che non si discutono
- **Produzione**: non modificarla e non promuovere deployment in produzione senza la mia approvazione esplicita in questa conversazione. Si lavora sull'**anteprima** del ramo release.
- **Destinatari**: niente email, inviti o messaggi a persone reali, salvo quelle dell'elenco che ti darò io. Per le prove usa caselle di prova che controllo io.
- **Pagamenti**: solo Stripe in **Test mode** con la carta `4242 4242 4242 4242`. Mai chiavi `sk_live_`, mai addebiti reali, mai fatture reali (lascia Fatture in Cloud scollegato nell'anteprima).
- **Costi**: non attivare piani a pagamento né acquistare servizi. Vercel Pro, piani Neon o Resend a pagamento si propongono e basta, con il costo verificato sulla pagina ufficiale.
- **Segreti**: non copiarli in chat, documenti, commenti o file del repository. Li incolli solo nei campi delle variabili d'ambiente o dei segreti. Non creare chiavi non necessarie.
- **Valori aziendali**: non inventare prezzi, percentuali, orari, competenze, lingue, limiti di sconto o regime IVA. Te li do io, oppure li lasci «da completare».
- **DNS**: prima di cambiare record (per esempio per verificare il dominio su Resend) chiedimi conferma e mostrami i record esatti.
- **Archiviazione**: non cancellare dati, progetti o database esistenti; si archivia.
- **Stato dichiarato**: non dichiarare «attivo» o «verificato» nulla che la Diagnostica del CRM non mostri come tale.

## Fase 1: anteprima pronta (spuntare in ordine)
1. Su Vercel, progetto `proemios`, trova l'anteprima più recente del ramo `release/team-demo-2026-10-14` e annota l'indirizzo.
2. **Database dell'anteprima.** In Settings → Environment Variables confronta `DATABASE_URL` con ambito *Preview* e con ambito *Production*. Guarda solo host e nome del database e non riportare la stringa.
   - Se coincidono, o se la variabile *Preview* manca: proponimi di creare un ramo gratuito del database in Neon (Branches → Create branch) e di usarlo solo per *Preview*. Procedi solo dopo il mio sì.
3. **Migrazioni.** Solo se il database dell'anteprima è separato, aggiungi `RUN_MIGRATIONS_ON_PREVIEW=1` con ambito **solo Preview**. Controlla in Settings → Build and Deployment che il «Build Command» non sia personalizzato: Vercel usa lo script `vercel-build` del progetto solo se non c'è un comando personalizzato.
4. **Cron.** Aggiungi `CRON_SECRET` (ambito Preview) con un valore casuale lungo, generato da un generatore di password.
5. **Stripe in Test mode.**
   - In Developers → API keys, imposta la chiave segreta di test come `STRIPE_SECRET_KEY` (ambito Preview).
   - In Developers → Webhooks, aggiungi l'endpoint `https://<anteprima>/api/webhooks/stripe` con gli eventi `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`, `refund.created`, `refund.updated`, `charge.dispute.created` e `charge.dispute.closed`.
   - Imposta il suo signing secret come `STRIPE_WEBHOOK_SECRET` (Preview).
6. **Email.** Su Resend controlla se il dominio di invio è verificato.
   - Se lo è: imposta `RESEND_API_KEY` ed `EMAIL_FROM` (mittente sul dominio verificato), ambito Preview.
   - Se non lo è: mostrami i record DNS necessari e aspetta la mia conferma.
7. **Protezione dell'anteprima.** Se è attiva e serve il collaudo automatico, crea un token «Protection Bypass for Automation» e conservalo solo per il passo di collaudo.
8. Fai il **Redeploy** dell'anteprima. Nei log di build cerca «Migrazioni dell'anteprima aggiornate».
9. Entra nell'anteprima come proprietario e apri **Impostazioni CRM → Diagnostica**.
   - Database, migrazioni e pagamenti («Modalità test») devono essere a posto.
   - Riportami lo stato di ogni voce, senza valori segreti.
10. Dopo la conferma delle migrazioni, rimuovi `RUN_MIGRATIONS_ON_PREVIEW`, oppure lasciala se ti dico di tenerla per i prossimi aggiornamenti.

## Fase 2: manutenzione frequente (`/api/cron/frequent` ogni 10–15 minuti)
Proponimi le due opzioni gratuite e procedi con quella che scelgo:
- **cron-job.org**: chiamata GET all'indirizzo dell'anteprima `/api/cron/frequent`, intestazione `Authorization: Bearer <CRON_SECRET>`, ogni 15 minuti. Richiede un account: chiedimi prima di crearlo.
- **GitHub Actions**: il file `.github/workflows/crm-frequent-cron.yml` esiste sul ramo release, ma GitHub lo esegue solo dal ramo predefinito (oggi `claude/kalamos-studio-phase-1-6z6xyw`). Servono:
  - una pull request che copi quel file sul ramo predefinito, da far approvare a me;
  - i segreti del repository `CRON_URL` (indirizzo completo di `/api/cron/frequent`) e `CRON_SECRET`.

Alla fine **Impostazioni CRM → Attività automatiche** deve mostrare «Manutenzione frequente: in regola». Se dopo 30 minuti risulta ancora «mai eseguito», dimmelo.

## Fase 3: collaudo degli scenari A–F
Segui `docs/CRM_COLLAUDO.md`.
- **Account**: crea sei account di prova sull'anteprima (proprietario, due venditori, un operatore, due clienti) con caselle che controllo io. Gli inviti si fanno da **Team e carichi**. Conserva le credenziali e gli URI `otpauth` solo in un file locale `collaudo-account.json`, mai nel repository e mai in chat.
- **Esecuzione**: se hai un terminale con Node 22 e il repository clonato, esegui `node scripts/collaudo-crm.mjs avvia`. Paga i checkout con la carta di prova, reinvia un evento da Stripe (Events → Resend), poi esegui `node scripts/collaudo-crm.mjs dopo-pagamento`. Se non hai un terminale, segui la tabella §4 di `docs/CRM_COLLAUDO.md` dall'interfaccia.
- **Rapporto**: per ogni scenario riporta «verificato» o «non verificato» con il motivo preciso. Allega gli screenshot delle schermate chiave senza dati personali. Non dichiarare verificato ciò che non hai visto succedere.

## Fase 4: decisioni e configurazione
1. Apri **Configurazione CRM** e leggimi l'elenco «Decisioni aziendali ancora da prendere», con le proposte.
2. Per ogni decisione chiedimi il valore. Riguardano:
   - flussi usati;
   - marchio ed email di assistenza;
   - pacchetti in vendita con link;
   - orari, festività e tempi di prima risposta;
   - finestra di relazione e cumulo venditore/affiliato;
   - percentuali provvigionali;
   - regime IVA e condizioni di pagamento (dal commercialista);
   - regola d'acquisto;
   - pianificatore.
3. Inserisci i valori che ti do dalle schermate di **Impostazioni CRM**, sempre con «Vedi cosa cambia» → controllo → «Approva e salva». Le regole economiche si trovano in **Regole economiche**.
4. Mostrami la Configurazione CRM finale: quali sezioni sono «configurata», «da completare» o «non necessaria».

## Fase 5: persone reali (solo con il mio elenco)
- Quando ti do l'elenco delle persone (nome, email, ruolo), invitale da **Team e carichi** con il modello di ruolo giusto, **nell'ambiente che ti indico**.
- Poi controlla lo stato degli inviti e segnalami errori di invio o profili incompleti.
- Competenze, lingue, capacità e sconti me li fai confermare persona per persona.

## Fase 6: produzione (solo con il mio «sì» esplicito)
Preparami una lista di passi per la produzione e **aspetta la mia approvazione** prima di qualsiasi azione. La lista deve coprire:
- le stesse variabili con ambito *Production*, con Stripe live e webhook live solo su mia decisione;
- le migrazioni in produzione, eseguite a mano con `npm run db:migrate` da un terminale: `RUN_MIGRATIONS_ON_PREVIEW` in produzione è rifiutato;
- un backup o un ramo Neon prima della migrazione;
- la promozione del deployment.

## Formato dei tuoi aggiornamenti
Alla fine di ogni fase mandami una tabella con quattro colonne: «Operativo e verificato», «Configurato ma non ancora verificato», «Da collegare», «Da decidere». Per ogni riga indica dove lo hai visto: Diagnostica, log di build, Stripe o altro.
