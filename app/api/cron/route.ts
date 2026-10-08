import { timingSafeEqual } from "node:crypto";
import { route, json, forbidden, unavailable } from "@/lib/platform/http";
import { maintenance } from "@/lib/platform/operations";
export const runtime="nodejs";
export const GET=route(async request=>{
  const secret=process.env.CRON_SECRET;if(!secret || !process.env.DATABASE_URL)throw unavailable();
  const expected=Buffer.from(`Bearer ${secret}`),given=Buffer.from(request.headers.get("authorization")??"");
  if(given.length!==expected.length || !timingSafeEqual(given,expected))throw forbidden();return json(await maintenance());
});
