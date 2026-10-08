import { redirect } from "next/navigation";
import { PlatformWorkspace } from "@/components/platform/workspace";
import { pageActor, PlatformUnavailable } from "@/lib/platform/page-access";
export const dynamic="force-dynamic";
export const metadata={title:"Il tuo spazio Proemios",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Page(){const actor=await pageActor();if(!actor)return <PlatformUnavailable/>;if(actor.staff && !actor.mfaEnabled)redirect("/sicurezza");return <PlatformWorkspace user={{id:actor.id,name:actor.name,email:actor.email,roles:actor.roles,grants:actor.grants,staff:actor.staff,mfaEnabled:actor.mfaEnabled}}/>;}
