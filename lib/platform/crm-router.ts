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
import { crmSettings, fieldCollection, notificationSettings, templateCollection } from "./crm-config";
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
      break;
    case "pool":
      if (!id) return poolCollection(request, actor);
      if (uuid(id) && action === "claim") return poolClaim(request, actor, id);
      break;
    case "leads":
      if (uuid(id) && action === "assign") return leadAssign(request, actor, id);
      break;
    case "settings":
      if (!id) return crmSettings(request, actor);
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
