/**
 * Font del progetto: due famiglie, servite in locale da `public/fonts/`.
 *
 * Le `@font-face` stanno in `app/globals.css`, con le metriche di fallback
 * (`ascent-override`, `size-adjust`…) che azzerano lo spostamento del testo
 * quando il font arriva. Qui c'è solo l'elenco delle facce da precaricare:
 * le due usate sopra la piega, Editorial regolare per i titoli e Interface
 * regolare per tutto il resto. Il grassetto di Interface e il corsivo di
 * Editorial arrivano con `font-display: swap` quando servono.
 *
 * Perché non `next/font/local`: con il layout radice dinamico (legge il nonce
 * della CSP da `headers()`), Next lascia i suggerimenti di preload nel flusso
 * RSC (`:HL[...]`) e non li scrive nell'HTML, quindi il browser li scopre solo
 * dopo aver eseguito il runtime client — cioè troppo tardi perché servano.
 * Un `<link rel="preload">` scritto a mano nel layout è l'unico modo di avere
 * il preload vero. Gli URL sono stabili e la cache è immutabile
 * (`next.config.mjs`): se una faccia cambia, cambia il nome del file.
 *
 * Licenza: URW base35, AGPL-3 con eccezione per i font (`public/fonts/LICENSE.txt`).
 * I woff2 sono convertiti con fontTools dagli OTF originali.
 */
export const PRELOAD_FONT = ["/fonts/editorial.woff2", "/fonts/interface.woff2"] as const;
