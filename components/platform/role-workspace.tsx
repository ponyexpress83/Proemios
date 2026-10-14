import { redirect } from "next/navigation";
import type { Route } from "next";
import { pageActor, PlatformUnavailable } from "@/lib/platform/page-access";
import { PlatformWorkspace } from "@/components/platform/workspace";
import type { Role } from "@/lib/platform/permissions";
import { RealAuthorWorkspace } from "@/components/author/real-workspace";
import { stagingPasswordOnly } from "@/lib/platform/staging-password-only";
import { allowedIn, REALM_HOME, REALM_LOGIN, realmFor, type Realm } from "@/lib/platform/realms";

export default async function RoleWorkspace({ realm }: { realm: Realm }) {
 const actor=await pageActor();
 if(!actor) return <PlatformUnavailable/>;
 // Chi entra nell'area sbagliata viene portato nella sua, non alla pagina di accesso:
 // è già autenticato. Chi non ha alcuna area adatta torna all'accesso di questa.
 if(!allowedIn(actor.roles,realm)){
  const home=realmFor(actor.roles);
  redirect((home!==realm?REALM_HOME[home]:REALM_LOGIN[realm]) as Route);
 }
 if(realm!=="author" && !actor.mfaEnabled && !stagingPasswordOnly(actor.email)) redirect("/sicurezza");
 if(realm==="author") return <RealAuthorWorkspace user={{id:actor.id,name:actor.name,email:actor.email,grants:actor.grants}}/>;
 return <PlatformWorkspace user={{id:actor.id,name:actor.name,email:actor.email,roles:actor.roles as Role[],grants:actor.grants,staff:actor.staff,mfaEnabled:actor.mfaEnabled}}/>;
}
