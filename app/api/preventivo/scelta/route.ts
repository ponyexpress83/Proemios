import { route } from "@/lib/platform/http";
import { publicQuotePreference } from "@/lib/platform/public-forms";
export const runtime = "nodejs";
export const POST = route(publicQuotePreference);
