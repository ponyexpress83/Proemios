import { route } from "@/lib/platform/http";
import { publicLinkMessage } from "@/lib/platform/crm-quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = route(async (request) => {
  const token = new URL(request.url).pathname.split("/").filter(Boolean)[3] ?? "";
  return publicLinkMessage(request, token);
});
