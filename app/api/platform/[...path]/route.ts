import { z } from "zod";
import { flushMailAfterResponse } from "@/lib/platform/mail";
import { billingProfile } from "@/lib/platform/billing";
import { quoteConfirm, quotePrefer } from "@/lib/platform/purchase";
import { overviewCollection } from "@/lib/platform/overview";
import { quoteReview, quoteOffer, quoteReminders } from "@/lib/platform/crm";
import { invoiceCollection, invoicePdf, invoiceRetry, invoiceStatus } from "@/lib/platform/invoices";
import { route, json, notFound, checkMutationOrigin } from "@/lib/platform/http";
import { getActor } from "@/lib/platform/access";
import { quotePdf } from "@/lib/platform/quote-pdf";
import {
  projectCollection,
  projectDetail,
  projectAssignment,
  projectMessages,
  projectUpload,
  projectReminders,
  fileDownload,
  fileApproval,
  taskCollection,
  taskUpdate,
} from "@/lib/platform/projects";
import {
  leadCollection,
  leadDetail,
  leadNote,
  createQuoteForLead,
  quoteCollection,
  quoteDetail,
  quoteAccept,
  quoteSend,
  quoteClaim,
  crmExport,
} from "@/lib/platform/crm";
import {
  teamCollection,
  invitationCollection,
  invitationRevoke,
  invitationAccept,
  membershipUpdate,
  settingsCollection,
  accountRequest,
  preferences,
} from "@/lib/platform/team";
import {
  checkout,
  quotePayments,
  financeCollection,
  financeExport,
  commissionCollection,
  commissionPaid,
  reconcile,
  refundPrepare,
} from "@/lib/platform/payments";
import {
  notificationCollection,
  notificationRead,
  affiliateCollection,
  affiliateManage,
  operationsCollection,
  operationRun,
  mailRetry,
  analysisRetry,
} from "@/lib/platform/operations";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handler = route(async (request) => {
  if (request.method !== "GET") {
    checkMutationOrigin(request);
    // Le email create da una mutazione (proposte, inviti, notifiche) partono
    // subito, non al cron del mattino dopo. La risposta non aspetta l'invio.
    flushMailAfterResponse(10);
  }
  const parts = new URL(request.url).pathname.split("/").filter(Boolean).slice(2),
    [area, id, action] = parts;
  if (parts.length > 3) throw notFound();
  const actor = await getActor(request, {
    allowUnenrolled: area === "me" || area === "invite-accept",
  });
  if (area === "me" && !id && request.method === "GET")
    return json({
      user: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        roles: actor.roles,
        grants: actor.grants,
        staff: actor.staff,
        mfaEnabled: actor.mfaEnabled,
      },
    });
  if (area === "me" && id === "billing" && !action) return billingProfile(request, actor);
  if (
    id &&
    !["export", "reconcile", "run", "status"].includes(id) &&
    !z.string().uuid().safeParse(id).success
  )
    throw notFound();
  switch (area) {
    case "projects":
      if (!id) return projectCollection(request, actor);
      if (!action) return projectDetail(request, actor, id);
      if (action === "members") return projectAssignment(request, actor, id);
      if (action === "messages") return projectMessages(request, actor, id);
      if (action === "files") return projectUpload(request, actor, id);
      if (action === "reminders") return projectReminders(request, actor, id);
      break;
    case "files":
      if (id && action === "download" && request.method === "GET") return fileDownload(actor, id);
      if (id && action === "approval") return fileApproval(request, actor, id);
      break;
    case "tasks":
      return id ? taskUpdate(request, actor, id) : taskCollection(request, actor);
    case "leads":
      if (!id) return leadCollection(request, actor);
      if (id === "export" && request.method === "GET") return crmExport(actor);
      if (!action) return leadDetail(request, actor, id);
      if (action === "notes") return leadNote(request, actor, id);
      if (action === "quotes") return createQuoteForLead(request, actor, id);
      break;
    case "quotes":
      if (!id) return quoteCollection(request, actor);
      if (!action) return quoteDetail(request, actor, id);
      if (action === "accept") return quoteAccept(request, actor, id);
      if (action === "send") return quoteSend(request, actor, id);
      if (action === "pdf" && request.method === "GET") return quotePdf(actor, id);
      if (action === "payments") return quotePayments(request, actor, id);
      if (action === "confirm") return quoteConfirm(request, actor, id);
      if (action === "prefer") return quotePrefer(request, actor, id);
      if (action === "review") return quoteReview(request, actor, id);
      if (action === "offer") return quoteOffer(request, actor, id);
      if (action === "reminders") return quoteReminders(request, actor, id);
      break;
    case "quote-claim":
      if (!id) return quoteClaim(request, actor);
      break;
    case "checkout":
      if (!id && request.method === "POST") return checkout(request, actor);
      break;
    case "overview":
      if (!id) return overviewCollection(request, actor);
      break;
    case "invoices":
      if (!id) return invoiceCollection(request, actor);
      if (id === "status" && !action) return invoiceStatus(request, actor);
      if (action === "pdf" && request.method === "GET") return invoicePdf(actor, id);
      if (action === "retry") return invoiceRetry(request, actor, id);
      break;
    case "team":
      if (!id) return teamCollection(request, actor);
      break;
    case "memberships":
      if (id && !action) return membershipUpdate(request, actor, id);
      break;
    case "invitations":
      if (!id) return invitationCollection(request, actor);
      if (!action) return invitationRevoke(request, actor, id);
      break;
    case "invite-accept":
      if (!id) return invitationAccept(request, actor);
      break;
    case "settings":
      if (!id) return settingsCollection(request, actor);
      break;
    case "notifications":
      if (!id) return notificationCollection(request, actor);
      if (!action) return notificationRead(request, actor, id);
      break;
    case "affiliates":
      if (!id)
        return request.method === "PATCH"
          ? affiliateManage(request, actor)
          : affiliateCollection(request, actor);
      break;
    case "commissions":
      if (!id) return commissionCollection(request, actor);
      if (!action) return commissionPaid(request, actor, id);
      break;
    case "finance":
      if (!id) return financeCollection(request, actor);
      if (id === "export" && request.method === "GET") return financeExport(actor);
      if (id === "reconcile") return reconcile(request, actor);
      break;
    case "refunds":
      if (!id) return refundPrepare(request, actor);
      break;
    case "operations":
      if (!id) return operationsCollection(request, actor);
      if (id === "run") return operationRun(request, actor);
      if (id && action === "analysis-retry") return analysisRetry(request, actor, id);
      if (id && action === "retry") return mailRetry(request, actor, id);
      break;
    case "account-request":
      if (!id) return accountRequest(request, actor);
      break;
    case "preferences":
      if (!id) return preferences(request, actor);
      break;
  }
  throw notFound();
});
export const GET = handler,
  POST = handler,
  PATCH = handler,
  PUT = handler,
  DELETE = handler;
