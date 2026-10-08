import { Security } from "@/components/platform/security";
import { pageActor, PlatformUnavailable } from "@/lib/platform/page-access";
export const dynamic="force-dynamic";
export const metadata={title:"Sicurezza del tuo account",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Page(){const actor=await pageActor();return actor?<Security enabled={actor.mfaEnabled}/>:<PlatformUnavailable/>;}
