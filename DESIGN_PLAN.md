# Proemios — Design del sito pubblico

Il sito pubblico segue la direzione «Matita rossa e blu»: carta, inchiostro,
due segni di correzione come unico colore. Il documento di lavoro — audit di
partenza, token, wireframe, componenti, autocritica per passaggio e verifica
finale — è `DESIGN-NOTES.md`; questo file dice solo dove stanno le cose.

> **Ambito.** Tutto ciò che sta dentro il route group `app/(sito)`, più
> `/accedi` e il 404. Le aree riservate — back-office, area autore, redazione —
> hanno un sistema proprio, scuro, descritto in `docs/DESIGN_SYSTEM.md`. I due
> convivono di proposito: chi compra legge una presenza editoriale, chi lavora
> usa un'interfaccia da strumento. Una pagina pubblica non importa `ui/*`.

## Dove stanno le cose

- **Token**: `app/globals.css` (blocco `@theme`: colori, corpi tipografici,
  spaziature, raggi, ombre, curva) e `app/sito.css` (regole del sito che non
  sono utilità: maiuscoletto, sottolineatura a matita, segni, indice, tappe).
- **Font**: `public/fonts/*.woff2`, Editorial (serif) e Interface (sans),
  sottoinsieme latino, dichiarati in `@font-face` con fallback metrici e
  precaricati dal layout radice.
- **Componenti**: `components/sito` — `Pulsante`, `Collegamento`, `Foglio`,
  `Campo`, `Sezione`/`Contenitore`/`Intestazione`, `Testata`, `Colophon`,
  `Carosello`, i segni di correzione in `segni.tsx`, le sezioni della home in
  `home/`. I blocchi di pagina riusati stanno in `components/marketing`,
  `components/sezioni`, `components/moduli`.
- **Marchio**: il monogramma «P» di `lib/brand-mark.ts`, in `components/sito/logo.tsx`,
  `app/icon.tsx` e `public/favicon.svg`.
- **Guscio**: `app/(sito)/layout.tsx` monta `GuscioSito` (banner DEMO,
  testata, `<main id="contenuto">`, colophon). `/accedi` ha un layout proprio
  con solo il logo.
- **Contenuti**: il catalogo (`config/catalogo.ts`) e i percorsi
  (`config/percorsi.ts`) sono la fonte di verità, con le tariffe di
  `config/pricing.ts`. `lib/editorial-content.ts` conserva le pagine di
  atterraggio che esistono solo lì, rese da
  `components/sito/contenuti-editoriali.tsx`. **Resta una decisione
  commerciale aperta**: se consolidare i due insiemi in uno.

## Regole che restano

- Nessun prezzo fuori da `config/pricing.ts`; nessun cliente, premio o
  risultato inventato; le schede del team arrivano solo verificate.
- Movimento solo sui segni di correzione e sulle transizioni brevi, e sempre
  dentro `prefers-reduced-motion`.
- Il banner DEMO resta finché `NEXT_PUBLIC_DEMO_MODE` non lo spegne.
