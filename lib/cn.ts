import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Unisce classi condizionali risolvendo i conflitti Tailwind (l'ultima vince).
 * Serve perché ogni componente del design system accetta `className` dal
 * chiamante: senza merge, `p-4` passato da fuori non sovrascriverebbe il `p-6`
 * interno, resterebbero entrambe e vincerebbe l'ordine nel CSS generato.
 *
 * La scala tipografica del sito pubblico (`text-t-xs` … `text-t-display`) va
 * dichiarata: tailwind-merge non la conosce e tratterebbe `text-t-sm` come un
 * colore, cancellando `text-bianco` nello stesso pulsante. È successo davvero
 * — testo inchiostro su fondo rosso, 3,02:1 — e axe l'ha trovato.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["t-xs", "t-sm", "t-base", "t-md", "t-lg", "t-xl", "t-display"] }],
    },
  },
});

export function cn(...classi: ClassValue[]): string {
  return twMerge(clsx(classi));
}
