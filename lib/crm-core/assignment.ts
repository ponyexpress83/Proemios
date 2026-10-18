/**
 * Scelta dell'assegnatario di una richiesta, nell'ordine dichiarato:
 * 1. resta il responsabile di una trattativa aperta dello stesso cliente;
 * 2. tra gli utenti attivi che partecipano, filtra per competenza e lingua;
 * 3. esclude assenti e chi ha la capacità piena; preferisce chi è in orario;
 * 4. bilancia per carico relativo (carico / capacità), poi per assegnazione meno recente.
 * Nessuno idoneo: coda monitorata. La presenza online non è mai un criterio.
 */
import { isAbsent, isWithinHours, personNextAvailable, type Absence, type BusinessHours } from "./hours";

export type AssignmentCandidate = {
  userId: string;
  active: boolean;
  verified: boolean;
  participates: boolean;
  skills: string[];
  languages: string[];
  hours: BusinessHours | null;
  absences: Absence[];
  capacity: number | null;
  openLoad: number;
  lastAssignedAt: Date | null;
};
export type AssignmentRequest = {
  requiredSkill: string | null;
  language: string;
  /** Responsabile della trattativa aperta dello stesso cliente, se esiste. */
  openDealOwner: { userId: string; active: boolean } | null;
  now: Date;
  orgHours: BusinessHours;
  defaultCapacity: number;
};
export type Exclusion = "inactive" | "unverified" | "not_participating" | "skill" | "language" | "absent" | "capacity";
export type AssignmentDecision = {
  assignee: string | null;
  reason: "open_deal_owner" | "balanced_in_hours" | "next_shift" | "no_eligible";
  /** Quando la persona scelta (o la coda) può prendere in carico la richiesta. */
  availableAt: Date;
  considered: Array<{ userId: string; excluded: Exclusion | null; load: number; capacity: number; inHours: boolean }>;
};

export function chooseAssignee(candidates: AssignmentCandidate[], request: AssignmentRequest): AssignmentDecision {
  if (request.openDealOwner?.active) return { assignee: request.openDealOwner.userId, reason: "open_deal_owner", availableAt: request.now, considered: [] };
  const considered = candidates.map((c) => {
    const capacity = c.capacity ?? request.defaultCapacity;
    const hours = c.hours ?? request.orgHours;
    let excluded: Exclusion | null = null;
    if (!c.active) excluded = "inactive";
    else if (!c.verified) excluded = "unverified";
    else if (!c.participates) excluded = "not_participating";
    else if (request.requiredSkill && c.skills.length > 0 && !c.skills.includes(request.requiredSkill)) excluded = "skill";
    else if (!(c.languages.length ? c.languages : ["it"]).includes(request.language)) excluded = "language";
    else if (isAbsent(request.now, c.absences)) excluded = "absent";
    else if (c.openLoad >= capacity) excluded = "capacity";
    return { candidate: c, userId: c.userId, excluded, load: c.openLoad, capacity, inHours: isWithinHours(request.now, hours), hours };
  });
  const eligible = considered.filter((c) => !c.excluded);
  const report = considered.map(({ userId, excluded, load, capacity, inHours }) => ({ userId, excluded, load, capacity, inHours }));
  if (!eligible.length) return { assignee: null, reason: "no_eligible", availableAt: personNextAvailable(request.now, request.orgHours), considered: report };
  const byLoad = (a: (typeof eligible)[number], b: (typeof eligible)[number]) =>
    a.load / a.capacity - b.load / b.capacity ||
    (a.candidate.lastAssignedAt?.getTime() ?? 0) - (b.candidate.lastAssignedAt?.getTime() ?? 0) ||
    a.userId.localeCompare(b.userId);
  const inHours = eligible.filter((c) => c.inHours).sort(byLoad);
  if (inHours.length) return { assignee: inHours[0]!.userId, reason: "balanced_in_hours", availableAt: request.now, considered: report };
  // Fuori orario per tutti: va a chi rientra per primo, che la prende nel primo periodo utile.
  const next = eligible
    .map((c) => ({ c, at: personNextAvailable(request.now, c.hours, c.candidate.absences) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime() || byLoad(a.c, b.c));
  return { assignee: next[0]!.c.userId, reason: "next_shift", availableAt: next[0]!.at, considered: report };
}
/**
 * Graduatoria per un suggerimento (lavori complessi): stessi filtri della
 * scelta automatica, ma restituisce tutti gli idonei in ordine e chi è escluso
 * con il motivo. La decisione resta a chi conferma.
 */
export function rankCandidates(candidates: AssignmentCandidate[], request: Omit<AssignmentRequest, "openDealOwner">) {
  const ranked: Array<{ userId: string; load: number; capacity: number; inHours: boolean; availableAt: Date }> = [];
  let pool = candidates;
  for (let i = 0; i < candidates.length; i++) {
    const decision = chooseAssignee(pool, { ...request, openDealOwner: null });
    if (!decision.assignee) break;
    const c = decision.considered.find((x) => x.userId === decision.assignee)!;
    ranked.push({ userId: decision.assignee, load: c.load, capacity: c.capacity, inHours: c.inHours, availableAt: decision.availableAt });
    pool = pool.filter((p) => p.userId !== decision.assignee);
  }
  const excluded = chooseAssignee(candidates, { ...request, openDealOwner: null }).considered.filter((c) => c.excluded);
  return { ranked, excluded };
}
