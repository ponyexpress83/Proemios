import { redirect } from "next/navigation";
import { pageActor, PlatformUnavailable } from "@/lib/platform/page-access";
import { PlatformWorkspace } from "@/components/platform/workspace";
import type { Role } from "@/lib/platform/permissions";
import { RealAuthorWorkspace } from "@/components/author/real-workspace";
import { stagingPasswordOnly } from "@/lib/platform/staging-password-only";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function RoleWorkspace({ realm }: { realm: "author" | "staff" | "partner" }) {
 const actor=await pageActor();
 if(!actor) return <PlatformUnavailable/>;
 const isAffiliate=actor.roles.includes("affiliate");
 const isAuthor=actor.roles.includes("author") && !actor.staff;
 const allowed=realm==="author"?isAuthor:realm==="partner"?isAffiliate:actor.staff&&!isAffiliate;
 if(!allowed) redirect(realm==="author"?"/accedi":realm==="partner"?"/accesso-partner":"/accesso-team");
 if(realm!=="author" && !actor.mfaEnabled && !stagingPasswordOnly(actor.email)) redirect("/sicurezza");
 if(realm==="author") return <RealAuthorWorkspace user={{id:actor.id,name:actor.name,email:actor.email,grants:actor.grants}}/>;
 return <PlatformWorkspace user={{id:actor.id,name:actor.name,email:actor.email,roles:actor.roles as Role[],grants:actor.grants,staff:actor.staff,mfaEnabled:actor.mfaEnabled}}/>;
}
