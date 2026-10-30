export const ROLES = [
  "owner",
  "admin",
  "author",
  "editor",
  "seller",
  "affiliate",
  "finance",
  "coordinator",
  "marketing",
] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_NAMES: Record<Role, string> = {
  owner: "Proprietario",
  admin: "Admin",
  author: "Autore",
  editor: "Editor",
  seller: "Venditore",
  affiliate: "Affiliato",
  finance: "Finance",
  coordinator: "Coordinatore editoriale",
  marketing: "Marketing",
};
export const PERMISSIONS = [
  "project.read",
  "project.write",
  "project.assign",
  "file.read",
  "file.upload",
  "file.deliver",
  "approval.read",
  "approval.write",
  "message.read",
  "message.write",
  "message.internal",
  "task.read",
  "task.write",
  "crm.read",
  "crm.write",
  "crm.assign",
  "crm.import",
  "quote.read",
  "quote.write",
  "quote.send",
  "quote.accept",
  "finance.read",
  "finance.record",
  "commission.read",
  "commission.write",
  "commission.pay",
  "refund.prepare",
  "refund.authorize",
  "affiliate.read",
  "affiliate.manage",
  "invite.manage",
  "role.manage",
  "settings.manage",
  "export",
  "operations.read",
  "operations.write",
  /** Marketing: ogni voce è separata e si delega una per una (anche a un Admin). */
  "marketing.read", // dashboard
  "marketing.campaigns", // registro campagne e link tracciati
  "marketing.contacts", // contatti autorizzati alle comunicazioni facoltative (campi minimi)
  "automation.draft", // bozze delle automazioni
  "automation.activate", // attivazione delle automazioni
  "revenue.aggregate", // ricavi aggregati (mai il dettaglio finanziario)
  "integrations.manage", // stato e configurazione dei collegamenti esterni (solo amministratori)
  /** CRM esteso */
  "crm.merge", // unione controllata di schede duplicate
  "quote.approve", // approvazione delle eccezioni (sconti oltre soglia, voci personalizzate, rate)
  "attribution.correct", // correzione autorizzata e motivata di un'attribuzione
  "support.read",
  "support.write",
  "report.read", // report su tempi di risposta, conversione, carico e ritardi
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type Scope = "own" | "assigned" | "organization";
export type Grant = { permission: Permission; scope: Scope };
export type Membership = { role: Role; grants: Grant[] | null; active: boolean };
const grant = (scope: Scope, permissions: Permission[]): Grant[] =>
  permissions.map((permission) => ({ permission, scope }));
const projectPermissions: Permission[] = [
  "project.read",
  "file.read",
  "file.upload",
  "approval.read",
  "message.read",
  "message.write",
  "task.read",
];
export const ROLE_GRANTS: Record<Role, Grant[]> = {
  owner: grant("organization", [...PERMISSIONS]),
  // Admin has editorial/CRM access; finance/security must be delegated separately.
  admin: grant("organization", [
    ...projectPermissions,
    "project.write",
    "project.assign",
    "file.deliver",
    "message.internal",
    "task.write",
    "crm.read",
    "crm.write",
    "crm.assign",
    "crm.import",
    "quote.read",
    "quote.write",
    "quote.send",
    "support.read",
    "support.write",
    "report.read",
  ]),
  author: grant("own", [
    ...projectPermissions,
    "project.write",
    "approval.write",
    "quote.read",
    "quote.accept",
  ]),
  editor: grant("assigned", [
    ...projectPermissions,
    "project.write",
    "file.deliver",
    "message.internal",
    "task.write",
  ]),
  coordinator: grant("assigned", [
    ...projectPermissions,
    "project.write",
    "project.assign",
    "file.deliver",
    "message.internal",
    "task.write",
    "support.read",
    "support.write",
  ]),
  seller: grant("assigned", [
    "crm.read",
    "crm.write",
    "quote.read",
    "quote.write",
    "quote.send",
    "task.read",
    "task.write",
    "commission.read",
    "support.read",
    "support.write",
  ]),
  affiliate: grant("own", ["affiliate.read", "commission.read"]),
  finance: grant("organization", [
    "finance.read",
    "finance.record",
    "commission.read",
    "commission.write",
    "quote.read",
    "export",
    "report.read",
  ]),
  // Marketing non vede manoscritti, documenti editoriali, fatture, dettaglio
  // finanziario, chiavi o utenti: solo dashboard, campagne, contatti autorizzati
  // e bozze di automazione. Attivazione, assegnazione, ricavi aggregati, export
  // e collegamenti si delegano a parte.
  marketing: [...grant("organization", ["marketing.read", "marketing.campaigns", "marketing.contacts", "automation.draft"]), ...grant("assigned", ["task.read", "task.write"])],
};
/** Permessi dell'area marketing, delegabili uno per uno a un Admin (profilo «Admin 2»). */
export const MARKETING_PERMISSIONS: Permission[] = ["marketing.read", "marketing.campaigns", "marketing.contacts", "automation.draft", "automation.activate", "crm.assign", "revenue.aggregate", "export", "integrations.manage"];
export function effectiveGrants(memberships: Membership[]): Grant[] {
  return memberships.filter((m) => m.active).flatMap((m) => m.grants ?? ROLE_GRANTS[m.role]);
}
export function can(
  grants: Grant[],
  permission: Permission,
  resource: { own?: boolean; assigned?: boolean } = {},
): boolean {
  return grants.some(
    (g) =>
      g.permission === permission &&
      (g.scope === "organization" ||
        (g.scope === "own" && resource.own === true) ||
        (g.scope === "assigned" && resource.assigned === true)),
  );
}
export function hasPermission(grants: Grant[], permission: Permission): boolean {
  return grants.some((g) => g.permission === permission);
}
export function canDelegate(grants: Grant[], requested: Grant[]): boolean {
  return requested.every((r) =>
    grants.some((g) => g.permission === r.permission && (g.scope === "organization" || g.scope === r.scope)),
  );
}
export function isStaff(m: Membership[]): boolean {
  return m.some((x) => x.active && x.role !== "author");
}
