# CRM: API versionata, moduli di acquisizione e webhook

Stato: **scritto nel codice e verificato nei test di integrazione** (`tests/crm.integration.test.ts`). Non attivo in produzione finché non viene creata una chiave e, per i webhook, registrato un indirizzo.

## Chiavi

| Tipo | Prefisso | Dove si usa | Scopi | Limiti |
|---|---|---|---|---|
| Server | `pk_…` | solo da server a server, mai nel browser | `leads:write`, `leads:read`, `deals:read`, `events:read` | richieste al minuto per chiave (predefinito 60) |
| Modulo pubblico | `pf_…` | nel sito, dentro il modulo | solo `capture` (crea una richiesta) | solo dalle origini dichiarate, richieste al minuto per chiave |

- Si creano in **Regole CRM → API e webhook** (serve il permesso `integrations.manage` e un accesso recente con verifica in due passaggi).
- La chiave completa si vede **una volta sola**. Nel database resta solo l'impronta SHA-256 e un prefisso per riconoscerla.
- Revoca immediata. Le chiavi create da una persona disattivata vengono revocate con lei.

## Endpoint

Descrizione completa in `GET /api/v1/openapi.json`.

| Metodo | Percorso | Scopo |
|---|---|---|
| `POST` | `/api/v1/leads` | `leads:write` o `capture` |
| `GET` | `/api/v1/leads/{id}` | `leads:read` |
| `GET` | `/api/v1/deals?updatedSince=…` | `deals:read` |
| `GET` | `/api/v1/events?after=…` | `events:read` |

### Acquisizione di una richiesta

```http
POST /api/v1/leads
Authorization: Bearer pk_xxxxxxxxxxxx_…
Idempotency-Key: modulo-partner-2026-10-17-0001
Content-Type: application/json

{ "name": "Maria Rossi", "email": "maria@example.test", "consentPrivacy": true,
  "source": { "kind": "partner", "detail": "Fiera del libro", "externalRef": "FL-123" },
  "priority": "normal", "language": "it", "service": "editing" }
```

- `Idempotency-Key` è obbligatoria. Con la stessa chiave e lo stesso corpo la risposta è la stessa (200). Con un corpo diverso la risposta è 409.
- La richiesta segue le stesse regole del sito: contatto unico per email, trattativa aperta riusata, assegnazione automatica o in coda, scadenza della prima risposta.
- Nessuna email parte verso la persona: la conferma spetta al sistema che invia la richiesta.
- La risposta contiene solo identificativi e stato: `leadId`, `contactId`, `dealId`, `assignment`, `slaDueAt`.

### Modulo pubblico (browser)

```html
<script>
fetch("https://app.example/api/v1/leads", { method: "POST",
  headers: { "content-type": "application/json", "x-proemios-form-key": "pf_…", "idempotency-key": crypto.randomUUID() },
  body: JSON.stringify({ name, email, consentPrivacy: true }) });
</script>
```

La risposta CORS viene data solo alle origini dichiarate sulla chiave. Da un'altra origine la richiesta è rifiutata (403).

## Webhook in uscita

- Si registrano in **Regole CRM → API e webhook** con un indirizzo HTTPS pubblico. Reti interne e `localhost` sono rifiutati.
- Eventi stabili: `lead.created`, `lead.assigned`, `deal.stage_changed`, `quote.accepted`, `payment.confirmed`, `project.handoff_ready`.
- I contenuti degli eventi portano identificativi e stati, **mai email, telefoni o testi liberi**.
- Ogni consegna ha queste intestazioni:
  - `Proemios-Event-Id`: identico a ogni ritentativo, serve a scartare i doppioni;
  - `Proemios-Event-Type`;
  - `Proemios-Signature: t=<unix>,v1=<hex>`, cioè HMAC-SHA256 di `"<t>.<corpo>"` con il segreto mostrato alla creazione.
- Ritentativi: 30 s, poi 1, 2, 4… minuti, al massimo 6 ore tra un tentativo e l'altro e 8 tentativi in tutto. Ogni esito resta nel registro delle consegne.
- Il segreto è conservato cifrato (JWE) e non viene più mostrato.

Verifica lato ricevente (Node):

```js
import { createHmac, timingSafeEqual } from "node:crypto";
function verify(secret, rawBody, header, tolerance = 300) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest();
  const given = Buffer.from(v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

## Cosa resta da configurare

- Nessuna chiave o webhook esiste finché un amministratore non li crea.
- Il cron di manutenzione (`/api/cron/...`, già esistente) consegna i webhook, gestisce le scadenze e manda il riepilogo del mattino. Deve essere attivo nell'ambiente.
