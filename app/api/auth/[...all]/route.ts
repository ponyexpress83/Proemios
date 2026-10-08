import { getAuth } from "@/lib/auth";
import { route } from "@/lib/platform/http";
import { after } from "next/server";
import { flushMail } from "@/lib/platform/mail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const handle = route(async (request) => {
  const response = await getAuth().handler(request);
  response.headers.set("Cache-Control", "private, no-store");
  if (request.method === "POST") after(async () => { await flushMail(5); });
  return response;
});
export const GET = handle;
export const POST = handle;
