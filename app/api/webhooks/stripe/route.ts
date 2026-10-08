import { getDb } from "@/db";
import { auditEvents } from "@/db/platform-schema";
import { stripe } from "@/lib/stripe";
import { route, json, PlatformError, unavailable } from "@/lib/platform/http";
import { processStripeEvent } from "@/lib/platform/payments";
export const runtime="nodejs";
export const POST=route(async request=>{
  if(!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY || !process.env.DATABASE_URL)throw unavailable();
  const signature=request.headers.get("stripe-signature");if(!signature)throw new PlatformError(400,"MISSING_SIGNATURE","Firma mancante.");
  const raw=await request.text();if(raw.length>1_000_000)throw new PlatformError(413,"TOO_LARGE","Richiesta troppo grande.");
  let event;try{event=stripe().webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET);}catch{throw new PlatformError(400,"INVALID_SIGNATURE","Firma non valida.");}
  try { return json(await processStripeEvent(event)); }
  catch (error) {
    await getDb().insert(auditEvents).values({ action: "stripe.event.failed", resourceType: "stripe-event", resourceId: event.id, detail: { code: error instanceof PlatformError ? error.code : "PROCESSING_ERROR" } }).catch(() => {});
    throw error;
  }
});
