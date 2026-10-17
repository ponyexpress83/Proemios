/**
 * Router del CRM esteso: /api/platform/crm/<risorsa>/<id>/<azione>.
 * Ogni segmento è validato (nomi da elenco, id UUID o id utente); i permessi
 * si controllano nei moduli, mai qui soltanto.
 */
import { z } from "zod";
import type { Actor } from "./access";
import { notFound } from "./http";
import { companyCollection, contactCollection, contactDetail, contactMerge, duplicateCollection, savedViews } from "./crm-contacts";
import { dealCollection, dealDetail } from "./crm-deals";
import { leadAssign, poolClaim, poolCollection } from "./crm-routing";
import { catalogView, crmSettings, fieldCollection, notificationSettings, templateCollection } from "./crm-config";
import { approvalCollection, dealPackageLink, linkClaim, linkCollection, linkPurchase, quoteAmend, quoteLines, quoteShareLink, quoteTerms } from "./crm-quotes";
import { attributionDetail, commissionSummary } from "./crm-attribution";
import { handoffAccept, handoffDetail, handoffItemCreate, handoffItemDecide, projectOps, projectPhases, projectSuggestions, taskAssign, taskClaim, taskQueue, taskStatus } from "./crm-handoff";
import { crmReports, supportCollection, workBoard, workMove, workSummary } from "./crm-work";
import { apiKeyCollection, webhookCollection } from "./crm-api";
import { automationStatus } from "./automation";
import { diagnosticsCollection } from "./diagnostics";
import { setupCollection, simulateAssignment } from "./crm-setup";
import { teamDeactivate, teamDirectory, teamProfile, teamReactivate, templateInvite } from "./crm-team";

const uuid = (v: string | undefined): v is string => Boolean(v) && z.string().uuid().safeParse(v).success;
const userId = (v: string | undefined): v is string => Boolean(v) && /^[A-Za-z0-9_-]{8,64}$/.test(v!);

export async function crmRoute(request: Request, actor: Actor, parts: string[]): Promise<Response> {
  if (parts.length > 3) throw notFound();
  const [resource, id, action] = parts;
  switch (resource) {
    case "contacts":
      if (!id) return contactCollection(request, actor);
      if (!uuid(id)) break;
      if (!action) return contactDetail(request, actor, id);
      if (action === "merge") return contactMerge(request, actor, id);
      break;
    case "duplicates":
      if (!id) return duplicateCollection(request, actor);
      break;
    case "companies":
      if (!id) return companyCollection(request, actor);
      if (uuid(id) && !action) return companyCollection(request, actor, id);
      break;
    case "views":
      if (!id) return savedViews(request, actor);
      if (uuid(id) && !action) return savedViews(request, actor, id);
      break;
    case "deals":
      if (!id) return dealCollection(request, actor);
      if (uuid(id) && !action) return dealDetail(request, actor, id);
      if (uuid(id) && action === "package-link") return dealPackageLink(request, actor, id);
      break;
    case "quotes":
      if (!uuid(id)) break;
      if (action === "lines") return quoteLines(request, actor, id);
      if (action === "terms") return quoteTerms(request, actor, id);
      if (action === "amend") return quoteAmend(request, actor, id);
      if (action === "link") return quoteShareLink(request, actor, id);
      break;
    case "links":
      if (!id) return linkCollection(request, actor);
      if (id === "claim" && !action) return linkClaim(request, actor);
      if (id === "purchase" && !action) return linkPurchase(request, actor);
      if (uuid(id) && !action) return linkCollection(request, actor, id);
      break;
    case "approvals":
      if (!id) return approvalCollection(request, actor);
      if (uuid(id) && !action) return approvalCollection(request, actor, id);
      break;
    case "attributions":
      if (uuid(id) && !action) return attributionDetail(request, actor, id);
      break;
    case "commissions":
      if (id === "summary" && !action) return commissionSummary(request, actor);
      break;
    case "pool":
      if (!id) return poolCollection(request, actor);
      if (uuid(id) && action === "claim") return poolClaim(request, actor, id);
      break;
    case "leads":
      if (uuid(id) && action === "assign") return leadAssign(request, actor, id);
      break;
    case "handoffs":
      if (!uuid(id)) break;
      if (!action) return handoffDetail(request, actor, id);
      if (action === "items") return handoffItemCreate(request, actor, id);
      if (action === "accept") return handoffAccept(request, actor, id);
      break;
    case "handoff-items":
      if (uuid(id) && action === "decide") return handoffItemDecide(request, actor, id);
      break;
    case "projects":
      if (!uuid(id)) break;
      if (action === "ops") return projectOps(request, actor, id);
      if (action === "phases") return projectPhases(request, actor, id);
      if (action === "suggestions") return projectSuggestions(request, actor, id);
      break;
    case "tasks":
      if (id === "queue" && !action) return taskQueue(request, actor);
      if (!uuid(id)) break;
      if (!action) return taskStatus(request, actor, id);
      if (action === "assign") return taskAssign(request, actor, id);
      if (action === "claim") return taskClaim(request, actor, id);
      break;
    case "work":
      if (!id) return workBoard(request, actor);
      if (id === "summary" && !action) return workSummary(request, actor);
      if (["deal", "task", "project"].includes(id) && uuid(action)) return workMove(request, actor, id, action);
      break;
    case "support":
      if (!id) return supportCollection(request, actor);
      if (uuid(id) && !action) return supportCollection(request, actor, id);
      break;
    case "reports":
      if (!id) return crmReports(request, actor);
      break;
    case "api-keys":
      if (!id) return apiKeyCollection(request, actor);
      if (uuid(id) && !action) return apiKeyCollection(request, actor, id);
      break;
    case "webhooks":
      if (!id) return webhookCollection(request, actor);
      if (uuid(id)) return webhookCollection(request, actor, id, action);
      break;
    case "setup":
      if (!id) return setupCollection(request, actor);
      break;
    case "assignment":
      if (id === "simulate" && !action) return simulateAssignment(request, actor);
      break;
    case "automation":
      if (!id) return automationStatus(request, actor);
      break;
    case "diagnostics":
      if (!id) return diagnosticsCollection(request, actor);
      break;
    case "settings":
      if (!id) return crmSettings(request, actor);
      if (id === "history" && !action) return crmSettings(request, actor, "history");
      break;
    case "catalog":
      if (!id) return catalogView(request, actor);
      break;
    case "fields":
      if (!id) return fieldCollection(request, actor);
      if (uuid(id) && !action) return fieldCollection(request, actor, id);
      break;
    case "templates":
      if (!id) return templateCollection(request, actor);
      if (uuid(id)) return templateCollection(request, actor, id, action);
      break;
    case "notifications":
      if (!id) return notificationSettings(request, actor);
      break;
    case "team":
      if (!id) return teamDirectory(request, actor);
      if (id === "templates" && !action) return templateInvite(request, actor);
      if (id === "invite" && !action) return templateInvite(request, actor);
      if (!userId(id)) break;
      if (action === "profile") return teamProfile(request, actor, id);
      if (action === "deactivate") return teamDeactivate(request, actor, id);
      if (action === "reactivate") return teamReactivate(request, actor, id);
      break;
  }
  throw notFound();
}
