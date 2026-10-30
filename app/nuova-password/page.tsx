import { AuthForm } from "@/components/platform/auth-form";
export const metadata={title:"Nuova password",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const p=await searchParams;return <AuthForm mode="new-password" token={p.token}/>;}
