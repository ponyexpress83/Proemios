# Dipendenze e vulnerabilità note

Stato verificato il 28 settembre 2026, prima del go-live.

## Sintesi

Partenza: **14 vulnerabilità** (1 critical, 6 high, 7 moderate).
Stato attuale: **6 moderate**, nessuna critical, nessuna high.

Tutte e sei riguardano strumenti di sviluppo e di test. Nessuna entra nel
bundle servito al browser né nel runtime di produzione.

## Risolte

| Pacchetto | Gravità | Come |
|---|---|---|
| `next` | critical | aggiornato (RCE su server Windows; noi siamo su Linux, ma l'aggiornamento è comunque dovuto) |
| `@xmldom/xmldom` | high | aggiornato via `mammoth` |
| `js-yaml` | high | aggiornato |
| `nanoid` | high | aggiornato |
| `sharp` | high | aggiornato (CVE libvips) |
| `postcss` | high | `overrides` a `^8.5.25`: Next annidava una propria copia `8.4.31` |
| `qs` | moderate | aggiornato |
| `drizzle-orm` | **high** | `0.38.3 → 0.45.3` (major). SQL injection su identificatori non correttamente quotati. Verificato con 428 test unitari e 149 di integrazione su Postgres reale: nessuna regressione. |
| `drizzle-kit` | moderate | `0.30.2 → 0.31.11` |

## Accettate, con motivazione

### `esbuild` (moderate) — via `drizzle-kit`

*"esbuild enables any website to send any requests to the development server
and read the response."*

Riguarda il **server di sviluppo** di esbuild. `drizzle-kit` lo usa per
trasformare `drizzle.config.ts`, e noi lo invochiamo solo come
`drizzle-kit generate` e `drizzle-kit migrate`: nessun server viene mai
avviato, né in sviluppo né in CI né in produzione.

`npm audit` propone come rimedio `drizzle-kit@0.18.1`, che è una **versione
molto più vecchia** di quella che usiamo: sarebbe una regressione, non una
correzione. Rimandato all'aggiornamento successivo di `drizzle-kit`.

### `vitest` / `@vitest/mocker` (moderate)

*"Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock."*

Dipendenza di solo test: non compare in `dependencies` e non finisce in
alcun artefatto di produzione. Per essere sfruttata occorre eseguire un file
di test o un mock malevolo — chi può farlo ha già l'esecuzione di codice
arbitrario nella pipeline.

La correzione richiede `vitest@5`, che sostituisce esbuild con **Rolldown**.
Provato: Rolldown non deduce il JSX dall'estensione del file, e importare un
`.tsx` (per esempio `lib/seo.tsx`) fa fallire il parsing dell'intero file di
test — 4 file di integrazione su 10 non partono più. L'opzione
`esbuild.jsx` non ha effetto sul nuovo trasformatore.

Inseguire quel major alla vigilia del go-live rischia di cambiare in modo
silenzioso il comportamento della suite, che è la rete di sicurezza di tutto
il resto. Rimandato a **dopo il live**, come primo intervento di
manutenzione.

## Come ricontrollare

```bash
npm audit --audit-level=high   # deve uscire pulito
npm audit                      # 6 moderate attese, elencate sopra
```

Se compare una nuova critical o high, va risolta prima del rilascio
successivo, oppure aggiunta qui con la stessa analisi.
