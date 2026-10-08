import { route, checkMutationOrigin } from "@/lib/platform/http";
import { getActor } from "@/lib/platform/access";
import { checkout } from "@/lib/platform/payments";
export const runtime="nodejs";
export const POST=route(async request=>{checkMutationOrigin(request);return checkout(request,await getActor(request));});
