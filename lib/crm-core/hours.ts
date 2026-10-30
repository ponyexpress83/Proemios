/**
 * Orari di servizio e scadenze (SLA) in un fuso orario dichiarato. Funzioni
 * pure: nessuna dipendenza dal database o dal dominio. La presenza online non
 * conta: conta solo l'orario di servizio dichiarato e le assenze registrate.
 */
import { z } from "zod";

export const businessHoursSchema = z
  .object({
    timezone: z.string().min(1).max(60).default("Europe/Rome"),
    /** Giorni lavorativi: 0 domenica … 6 sabato. */
    days: z.array(z.number().int().min(0).max(6)).max(7).default([1, 2, 3, 4, 5]),
    start: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
    end: z.string().regex(/^\d{2}:\d{2}$/).default("18:00"),
    /** Giorni di chiusura in formato AAAA-MM-GG nel fuso dichiarato. */
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(400).default([]),
  })
  .strict();
export type BusinessHours = z.infer<typeof businessHoursSchema>;
export const defaultBusinessHours: BusinessHours = { timezone: "Europe/Rome", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00", holidays: [] };

export type Absence = { from: string; to: string; reason?: string | null };

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timezone: string) {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
    formatters.set(timezone, f);
  }
  return f;
}
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function localParts(date: Date, timezone: string) {
  const parts = Object.fromEntries(formatter(timezone).formatToParts(date).map((p) => [p.type, p.value]));
  const y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  return { y, m, d, ymd: `${parts.year}-${parts.month}-${parts.day}`, weekday: WEEKDAYS[parts.weekday as string] ?? 0, minutes: Number(parts.hour) * 60 + Number(parts.minute), seconds: Number(parts.second) };
}
function offsetMs(date: Date, timezone: string) {
  const p = localParts(date, timezone);
  return Date.UTC(p.y, p.m - 1, p.d, Math.floor(p.minutes / 60), p.minutes % 60, p.seconds) - Math.floor(date.getTime() / 1000) * 1000;
}
/** Istante UTC corrispondente all'ora locale `minutes` del giorno y-m-d nel fuso dato. */
export function zonedTime(y: number, m: number, d: number, minutes: number, timezone: string): Date {
  const guess = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  let result = guess - offsetMs(new Date(guess), timezone);
  result = guess - offsetMs(new Date(result), timezone);
  return new Date(result);
}
function isOpenDay(p: ReturnType<typeof localParts>, hours: BusinessHours) {
  return hours.days.includes(p.weekday) && !hours.holidays.includes(p.ymd);
}
export function isWithinHours(date: Date, hours: BusinessHours = defaultBusinessHours): boolean {
  const p = localParts(date, hours.timezone);
  return isOpenDay(p, hours) && p.minutes >= minutesOf(hours.start) && p.minutes < minutesOf(hours.end);
}
/**
 * Aggiunge minuti contando solo l'orario di servizio. Con 0 minuti restituisce
 * il primo istante utile (adesso, se l'ufficio è aperto).
 */
export function addBusinessMinutes(start: Date, minutes: number, hours: BusinessHours = defaultBusinessHours): Date {
  const open = minutesOf(hours.start), close = minutesOf(hours.end);
  if (close <= open || !hours.days.length) return new Date(start.getTime() + minutes * 60_000);
  let cursor = new Date(start.getTime()), remaining = Math.max(0, minutes);
  for (let guard = 0; guard < 800; guard++) {
    const p = localParts(cursor, hours.timezone);
    if (isOpenDay(p, hours)) {
      if (p.minutes < open) { cursor = zonedTime(p.y, p.m, p.d, open, hours.timezone); continue; }
      if (p.minutes < close) {
        const available = close - p.minutes;
        if (remaining <= available) return new Date(cursor.getTime() + remaining * 60_000);
        remaining -= available;
      }
    }
    const next = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
    cursor = zonedTime(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, hours.timezone);
  }
  return new Date(start.getTime() + minutes * 60_000);
}
export const nextOpening = (date: Date, hours: BusinessHours = defaultBusinessHours) => addBusinessMinutes(date, 0, hours);
export function isAbsent(date: Date, absences: Absence[] = []): boolean {
  const t = date.getTime();
  return absences.some((a) => {
    const from = Date.parse(a.from), to = Date.parse(a.to);
    return Number.isFinite(from) && Number.isFinite(to) && t >= from && t < to;
  });
}
/** Prima ora utile di una persona: orario proprio (o dell'ufficio), saltando le assenze. */
export function personNextAvailable(date: Date, hours: BusinessHours, absences: Absence[] = []): Date {
  let cursor = nextOpening(date, hours);
  for (let guard = 0; guard < 50 && isAbsent(cursor, absences); guard++) {
    const ending = absences.filter((a) => Date.parse(a.from) <= cursor.getTime() && cursor.getTime() < Date.parse(a.to)).map((a) => Date.parse(a.to));
    cursor = nextOpening(new Date(Math.max(...ending)), hours);
  }
  return cursor;
}
