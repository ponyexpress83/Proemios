/** Formattazione valuta in euro, stile italiano, senza decimali. */
export function euro(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Numero con separatore delle migliaia italiano. */
export function numero(value: number): string {
  return new Intl.NumberFormat("it-IT").format(value);
}

/** Data leggibile in italiano (es. 14 luglio 2026). */
export function dataEstesa(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
