# Dipendenze e licenze

Elenco delle dipendenze dirette in `package.json`, con versione installata e licenza dichiarata dal pacchetto (letta da `node_modules` il 17 ottobre 2026). L'intervento sul CRM **non ha aggiunto dipendenze**: nucleo, API e webhook usano Node (`crypto`), Drizzle, Zod e jose già presenti.

| Pacchetto | Versione | Licenza | Uso |
|---|---|---|---|
| @anthropic-ai/sdk | 0.32.1 | MIT | runtime |
| @neondatabase/serverless | 0.10.4 | MIT | runtime |
| @types/pg | 8.23.1 | MIT | runtime |
| @vercel/blob | 2.8.1 | Apache-2.0 | runtime |
| better-auth | 1.7.7 | MIT | runtime |
| drizzle-orm | 0.45.2 | Apache-2.0 | runtime |
| gray-matter | 4.0.3 | MIT | runtime |
| jose | 6.2.12 | MIT | runtime |
| lucide-react | 1.52.0 | ISC | runtime |
| mammoth | 1.12.0 | BSD-2-Clause | runtime |
| next | 15.5.22 | MIT | runtime |
| next-mdx-remote | 6.0.0 | MPL-2.0 | runtime |
| otpauth | 9.5.2 | MIT | runtime |
| pdf-lib | 1.17.1 | MIT | runtime |
| pdf-parse | 2.4.5 | Apache-2.0 | runtime |
| pg | 8.23.1 | MIT | runtime |
| qrcode.react | 4.2.0 | ISC | runtime |
| radix-ui | 1.6.7 | MIT | runtime |
| react | 19.2.8 | MIT | runtime |
| react-dom | 19.2.8 | MIT | runtime |
| resend | 4.8.0 | MIT | runtime |
| stripe | 17.7.0 | MIT | runtime |
| zod | 3.25.76 | MIT | runtime |
| @electric-sql/pglite | 0.3.14 | Apache-2.0 | sviluppo |
| @electric-sql/pglite-socket | 0.2.11 | Apache-2.0 | sviluppo |
| @eslint/eslintrc | 3.3.6 | MIT | sviluppo |
| @tailwindcss/postcss | 4.3.3 | MIT | sviluppo |
| @testing-library/dom | 10.4.1 | MIT | sviluppo |
| @testing-library/react | 16.3.3 | MIT | sviluppo |
| @types/node | 22.20.1 | MIT | sviluppo |
| @types/react | 19.2.18 | MIT | sviluppo |
| @types/react-dom | 19.2.4 | MIT | sviluppo |
| dotenv | 16.6.1 | BSD-2-Clause | sviluppo |
| drizzle-kit | 0.31.10 | MIT | sviluppo |
| eslint | 9.39.5 | MIT | sviluppo |
| eslint-config-next | 15.5.22 | MIT | sviluppo |
| jsdom | 30.1.2 | MIT | sviluppo |
| postcss | 8.5.25 | MIT | sviluppo |
| prettier | 3.9.6 | MIT | sviluppo |
| prettier-plugin-tailwindcss | 0.8.1 | MIT | sviluppo |
| tailwindcss | 4.3.3 | MIT | sviluppo |
| tsx | 4.23.5 | MIT | sviluppo |
| typescript | 5.9.3 | Apache-2.0 | sviluppo |
| vitest | 3.2.7 | MIT | sviluppo |

## Note per una futura distribuzione del CRM

- Tutte le licenze sono permissive (MIT, ISC, BSD, Apache-2.0), tranne `next-mdx-remote` (MPL-2.0, copyleft a livello di file). Serve solo alle pagine editoriali del sito e non al nucleo del CRM: in un prodotto estratto non va incluso, oppure i file modificati vanno resi disponibili.
- Apache-2.0 (`drizzle-orm`, `@vercel/blob`, `pdf-parse`, PGlite, TypeScript) chiede di conservare le note di copyright e il file NOTICE se presente.
- Le dipendenze transitive non sono elencate qui. Prima di una distribuzione commerciale va generato un inventario completo (per esempio con `npx license-checker --production --summary`) e conservato insieme alla versione rilasciata.
- `@anthropic-ai/sdk` serve all'analisi del manoscritto, non al CRM. Il CRM non usa modelli linguistici: nessun punteggio automatico opaco, nessuna sintesi automatica obbligatoria.
