import { AuthForm } from "@/components/platform/auth-form";
import { authConfigured } from "@/lib/platform/config";
export const dynamic="force-dynamic";
export const metadata={title:"Verifica il tuo accesso",robots:{index:false,follow:false},referrer:"no-referrer" as const};
// Il codice TOTP non passa dalla posta: la pagina funziona anche senza servizio email.
export default function Page(){return <AuthForm mode="challenge" ready={authConfigured()} team={true} realm="staff"/>;}
