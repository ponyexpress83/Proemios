import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Unisce classi condizionali risolvendo i conflitti Tailwind (l'ultima vince).
 * Serve perché ogni componente del design system accetta `className` dal
 * chiamante: senza merge, `p-4` passato da fuori non sovrascriverebbe il `p-6`
 * interno, resterebbero entrambe e vincerebbe l'ordine nel CSS generato.
 */
export function cn(...classi: ClassValue[]): string {
  return twMerge(clsx(classi));
}
