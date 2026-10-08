import { TokenClaim } from "@/components/platform/token-claim";
export const metadata={title:"Accesso personale",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function Page({searchParams}:{searchParams:Promise<{token?:string}>}){const params=await searchParams;return <TokenClaim kind="quote-claim" token={params.token?.slice(0,200)??""}/>;}
