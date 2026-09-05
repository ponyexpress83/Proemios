/**
 * Guscio minimo delle pagine di accesso: nessuna navigazione, nessun piè di
 * pagina. Chi sta entrando non deve avere altre strade davanti, e le pagine di
 * accesso non sono indicizzabili.
 *
 * `id="contenuto"` è la destinazione del link «Vai al contenuto» del layout
 * radice: senza, quel link porterebbe a un'ancora inesistente.
 */
export default function LayoutAccesso({ children }: { children: React.ReactNode }) {
  return <main id="contenuto">{children}</main>;
}
