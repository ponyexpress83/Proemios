import { redirect } from "next/navigation";
import type { Route } from "next";
import { PlatformWorkspace } from "@/components/platform/workspace";
import { pageActor, PlatformUnavailable } from "@/lib/platform/page-access";
import { stagingPasswordOnly } from "@/lib/platform/staging-password-only";
import { REALM_HOME, realmFor } from "@/lib/platform/realms";
export const dynamic="force-dynamic";
export const metadata={title:"Il tuo spazio Proemios",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const actor=await pageActor();if(!actor)return <PlatformUnavailable/>;
// Gli autori hanno la loro area: /spazio resta lo spazio di lavoro del team e dei partner.
if(realmFor(actor.roles)==="author"){const sp=await searchParams;const q=new URLSearchParams();for(const [k,v] of Object.entries(sp))if(v)q.set(k,v);redirect(`${REALM_HOME.author}${q.size?`?${q}`:""}` as Route);}
if(actor.staff && !actor.mfaEnabled && !stagingPasswordOnly(actor.email))redirect("/sicurezza");return <PlatformWorkspace user={{id:actor.id,name:actor.name,email:actor.email,roles:actor.roles,grants:actor.grants,staff:actor.staff,mfaEnabled:actor.mfaEnabled}}/>;}
