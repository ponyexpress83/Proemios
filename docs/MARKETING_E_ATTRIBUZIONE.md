# Area Marketing: ruolo, permessi, campagne, attribuzione, dashboard

## Ruolo e permessi (`lib/platform/permissions.ts`)

Ruolo `marketing` (account individuale, invito e verifica in due passaggi come il resto del team). Permessi predefiniti: `marketing.read` (dashboard), `marketing.campaigns` (registro campagne, link tracciati, spesa), `marketing.contacts` (contatti autorizzati, campi minimi), `automation.draft` (bozze). Deleghe separate, mai nel ruolo: `automation.activate`, `crm.assign` (assegnazione), `revenue.aggregate` (ricavi aggregati), `export`, `integrations.manage` (solo amministratori).

Il ruolo non ha `project.*`, `file.*`, `crm.read/write`, `finance.*`, `invoice`, `role.manage`, `settings.manage`: niente manoscritti, documenti editoriali, fatture dei collaboratori, dettaglio finanziario, chiavi o utenti. Ogni endpoint lo verifica sul server (test "gives Marketing only its own modules").

### Assegnare gli stessi permessi a un Admin ("Admin 2")

1. *Persone e accessi* → aprire la persona → la sua appartenenza **Admin** → sezione *Permessi marketing per questo profilo*.
2. Spuntare uno per uno i permessi da dare (dashboard, campagne, contatti, bozze, attivazione, assegnazione, ricavi aggregati, export, collegamenti) → *Salva permessi marketing*. L'API è `PATCH memberships/:id {active, grants}`; le sessioni della persona vengono chiuse e deve rientrare.
3. Il proprietario può delegare solo ciò che possiede; un admin "limitato" resta tale: i permessi non marketing non cambiano.

## Registro campagne (`platform_campaigns`)

Nome, canale (`google_ads`, `meta`, `email`, `marketplace`, `partner`, `organic`, `referral`, `other`), stato (`draft`, `active`, `paused`, `ended`), periodo, destinazione (percorso interno), `utm_source/medium/campaign/content/term` (unici per source+medium+campaign), partner o venditore, budget, note. `POST/GET campaigns`, `GET/PATCH campaigns/:id`.

**Link tracciato** (`trackedLink`): `https://<dominio>/<destinazione>?utm_source=…&utm_medium=…&utm_campaign=…&pc=<id campagna>`. Nessuna email o altro dato personale nell'URL.

**Spesa** (`platform_campaign_spend`): righe per giorno con spesa, clic, impressioni e origine; `POST campaigns/:id/spend` con JSON o CSV (`day/data/giorno`, `spend/costo/spesa`, `clicks/clic`, `impressions/impressioni`; separatore `,` o `;`, decimali con virgola ammessi). Doppioni su campagna+giorno+origine ignorati e conteggiati. Nessun collegamento automatico a Google Ads o Meta (vedi `docs/INTEGRAZIONI.md`).

**Risultati per campagna**: contatti attribuiti, proposte, acquisti, spesa, budget usato, costo per contatto, costo per acquisto; incassato e ROAS solo con `revenue.aggregate`.

## Attribuzione (`lib/attribution-client.ts`, `lib/platform/public-forms.ts`)

Senza cookie: i parametri della visita (`utm_*`, `gclid`, `fbclid`, `pc`) restano in `sessionStorage` e viaggiano solo con la richiesta che la persona invia (preventivo, contatto). Il server li sanifica (`sanitizeAttribution`) e li salva in `leads.attribution`; `source_detail` riporta la campagna.

Regola documentata: **prima origine nota** per pagina di atterraggio, referrer e data della prima visita; **ultima origine nota** per UTM, click id e campagna. Attribuzione alla campagna per `pc` (link tracciato) o, in mancanza, per corrispondenza di source+medium+campaign. Visita diretta, Do Not Track attivo, nuova sessione o cambio dispositivo = origine sconosciuta (il contatto resta, senza attribuzione). Non si ricostruiscono percorsi tra dispositivi.

Gli eventi del configuratore (`/api/eventi`) usano una chiave di sessione anonima (solo per contare passi e abbandoni nella scheda corrente); nessun IP, nessuna identità.

## Dashboard (`GET marketing?giorni=30`)

Ogni metrica porta `definition`, `source`, `updatedAt`, `status` (`ok`, `to_connect` = "Da collegare", `unavailable` = "Non disponibile", `unauthorized`) e `demo` (vero solo con `DEMO_MODE=on` fuori produzione). Metriche: visite e sorgenti (da collegare finché non c'è Analytics), preventivi avviati/completati, abbandoni del configuratore, checkout avviati, pagamenti falliti, acquisti conclusi, quota autonomi vs assistiti, proposte recuperate, contatti per origine, contatti con origine di campagna, valore contrattuale / incassato / rimborsato / fatturato (solo con `revenue.aggregate`), spesa, costo per contatto e per acquisto, email operative inviate e non recapitate, andamento campagne email (da collegare a Brevo).

La fonte economica è sempre la piattaforma (ordini confermati dal webhook, registro, contratti, fatture), mai gli eventi del browser.

## Contatti autorizzati (`GET marketing/contacts`)

Solo chi ha dato il consenso alle comunicazioni facoltative e non lo ha revocato: nome, email, origine, campagna, data del consenso, stato, responsabile. Niente note, telefono, documenti. Assegnazione con `crm.assign` (`PATCH marketing/contacts/:id`).

## Automazioni

Bozza (`PUT automations`, `automation.draft`) separata dall'attivazione (`POST automations/activate`, `automation.activate` o `settings.manage`, con verifica in due passaggi recente). La bozza non invia nulla. Le regole attivate sono quelle di `docs/CRM_E_RECUPERI.md`.
