import type { ReactNode } from "react";

/**
 * Era la comparsa allo scorrimento (`motion` + IntersectionObserver). Lasciava
 * intere sezioni bianche sotto la piega finché non entravano nel viewport, e
 * la misura dell'LCP lo pagava. Ora rende i figli e basta: resta come
 * componente perché molte pagine lo usano come contenitore, ma non anima più
 * niente. `ritardo` è accettato e ignorato.
 */
export function Apparizione({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  ritardo?: number;
}) {
  return <div className={className}>{children}</div>;
}
