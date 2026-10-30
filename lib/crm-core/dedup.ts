/**
 * Deduplicazione prudente: email, telefono, partita IVA o account in comune
 * rendono due schede unibili; il solo nome simile produce un avviso e non
 * permette mai l'unione.
 */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith("+") && digits.length >= 9 && digits.length <= 11) digits = `+39${digits}`;
  const only = digits.replace(/\D/g, "");
  return only.length >= 8 ? `+${only}` : null;
}
export function nameKey(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
}
export type DedupRecord = { id: string; email: string | null; phone: string | null; vatNumber?: string | null; userId?: string | null; name: string };
export type MatchKind = "email" | "phone" | "vat" | "account" | "name_only";
export function matchReasons(a: DedupRecord, b: DedupRecord): MatchKind[] {
  const out: MatchKind[] = [];
  if (a.email && b.email && normalizeEmail(a.email) === normalizeEmail(b.email)) out.push("email");
  const pa = normalizePhone(a.phone), pb = normalizePhone(b.phone);
  if (pa && pb && pa === pb) out.push("phone");
  if (a.vatNumber && b.vatNumber && a.vatNumber.replace(/\W/g, "").toUpperCase() === b.vatNumber.replace(/\W/g, "").toUpperCase()) out.push("vat");
  if (a.userId && b.userId && a.userId === b.userId) out.push("account");
  if (!out.length && nameKey(a.name) && nameKey(a.name) === nameKey(b.name)) out.push("name_only");
  return out;
}
export const mergeable = (reasons: MatchKind[]) => reasons.some((r) => r !== "name_only");
