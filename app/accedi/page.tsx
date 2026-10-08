import { AuthForm } from "@/components/platform/auth-form";
import { authConfigured, mailConfigured } from "@/lib/platform/config";
export const dynamic="force-dynamic";
export const metadata={title:"Accedi alla tua area autore",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default function Page(){return <AuthForm mode="login" ready={authConfigured() && mailConfigured()} team={false}/>;}
