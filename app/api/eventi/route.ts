import { route } from "@/lib/platform/http";
import { publicFunnelEvent } from "@/lib/platform/funnel";
export const runtime = "nodejs";
export const POST = route(publicFunnelEvent);
