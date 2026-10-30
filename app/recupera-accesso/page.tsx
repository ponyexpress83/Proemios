import { AuthForm } from "@/components/platform/auth-form";
import { authConfigured, mailConfigured } from "@/lib/platform/config";
export const dynamic="force-dynamic";
export const metadata={title:"Recupera il tuo accesso",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default function Page(){return <AuthForm mode="reset" ready={authConfigured() && mailConfigured()} team={false}/>;}
