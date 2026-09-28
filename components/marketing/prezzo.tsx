import type { PrezzoPubblico } from "@/config/catalogo";
import { euro, fascia, tariffaParola } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Rende un prezzo pubblico. Unico punto in cui un `PrezzoPubblico` diventa
 * testo: la formula "su preventivo" deve essere identica ovunque compaia, e la
 * motivazione va sempre mostrata insieme — un "su preventivo" senza perché
 * legge come una reticenza.
 */
export function Prezzo({
  prezzo,
  className,
  compatto = false,
}: {
  prezzo: PrezzoPubblico;
  className?: string;
  compatto?: boolean;
}) {
  if (prezzo.tipo === "preventivo") {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        <p className="text-base font-medium text-testo">Su preventivo</p>
        {!compatto ? <p className="text-sm text-testo-tenue">{prezzo.motivo}</p> : null}
      </div>
    );
  }

  const testo =
    prezzo.tipo === "forfait"
      ? euro(prezzo.importo)
      : prezzo.tipo === "fascia"
        ? fascia(prezzo.da, prezzo.a)
        : tariffaParola(prezzo.da, prezzo.a);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="cifre text-base font-medium text-testo">
        {prezzo.tipo === "fascia" || prezzo.tipo === "a-parola" ? (
          <span className="text-testo-tenue">da </span>
        ) : null}
        {testo}
      </p>
      {!compatto ? (
        <p className="text-sm text-testo-tenue">
          IVA esclusa
          {prezzo.tipo === "a-parola" && prezzo.minimo
            ? ` · minimo di progetto ${euro(prezzo.minimo)}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/** Riga compatta per le griglie di catalogo. */
export function PrezzoRiga({ prezzo }: { prezzo: PrezzoPubblico }) {
  if (prezzo.tipo === "preventivo") {
    return <span className="etichetta text-testo-tenue">Su preventivo</span>;
  }
  const testo =
    prezzo.tipo === "forfait"
      ? euro(prezzo.importo)
      : prezzo.tipo === "fascia"
        ? `da ${euro(prezzo.da)}`
        : `da ${tariffaParola(prezzo.da, prezzo.da)}`;
  return <span className="cifre text-sm text-testo-attenuato">{testo}</span>;
}
