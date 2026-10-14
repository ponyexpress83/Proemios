# Proemios - staging con account persistenti

## Destinazione
- Vercel preview branch: `feat/real-role-access-staging-20261014`.
- Neon database EU `green-river-20539550`, branch `staging`, database `proemios`; 131 istruzioni di migrazione applicate in transazione.
- Variabili preview legate *solo* al branch: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `PROEMIOS_OWNER_EMAIL`.
- Accessi: `/accedi` (autore), `/accesso-team` (owner, seller, coordinator, editor, finance), `/accesso-partner` (affiliate).
- Aree server-protected: `/area-autore`, `/area-team`, `/partner`; API usano RBAC su database esistente.
- Sono stati predisposti account isolati con domini `.invalid` nel DB staging (non produce email). Le credenziali sono consegnate separatamente al proprietario, **non in Git**.

## Differenze dalla produzione definitiva
- Il login per lo staff richiede MFA personale da configurare in `/sicurezza` prima dell’accesso alla dashboard. Esegui prima il primo accesso con le credenziali temporanee, attiva TOTP e conserva i recovery code.
- I tre accessi hanno percorsi distinti e guardie server, ma non ancora tre realm con cookie host-only separati su tre domini. Non chiamarli pienamente isolati al livello SSO.
- Email Resend non configurate: gli account pre-seeded verificati possono fare password login, ma invito, recupero credenziali e verifica delle nuove email richiedono attivare Resend.
- Stripe non configurato: il checkout reale resta fail-closed e rifiuta gli addebiti. Niente simulazioni in API reali.
- Non pubblicare dati clienti sensibili né promuovere la branch sul dominio di produzione.
- Impostare e collaudare `STRIPE_SECRET_KEY=sk_test_...`, webhook test, price policy, invoice provider, storage privato, alert e test end-to-end prima di un checkout Stripe in modalità test.
- Prima di passare a email vere: invitare account reali con verifica, eseguire MFA, trasferire assegnazioni, revocare account demo `.invalid`; non cambiare manualmente le identità utenti lasciando vecchie sessioni valide.
- Non usare inviti reali o seed con clienti in produzione senza le approvazioni necessarie.
