import { after } from "next/server";
import { route } from "@/lib/platform/http";
import { publicQuote } from "@/lib/platform/public-forms";
import { flushMail } from "@/lib/platform/mail";
export const runtime = "nodejs";
export const POST = route(async request => {
  const result = await publicQuote(request);
  if (result.ok) after(async () => { await flushMail(5); });
  return result;
});
