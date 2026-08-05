/** Euro, stile italiano, senza decimali (i prezzi sono sempre interi). */
export function euro(v: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
}

/** Numero con separatore delle migliaia italiano. */
export function numero(v: number): string {
  return new Intl.NumberFormat("it-IT").format(v);
}

/** Fascia di prezzo: "€ 700 – € 3.500". */
export function fascia(min: number, max: number): string {
  return `${euro(min)} – ${euro(max)}`;
}

/** Data estesa in italiano (es. 5 agosto 2026). */
export function dataEstesa(v: Date | string): string {
  const d = typeof v === "string" ? new Date(v) : v;
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
