import { NextResponse,type NextRequest } from "next/server";
const PROTECTED = ["/spazio","/area-autore","/area-team","/partner","/admin","/sicurezza"];
export function middleware(request:NextRequest){
 const path=request.nextUrl.pathname;
 const authenticated=Boolean(request.cookies.get("better-auth.session_token")||request.cookies.get("__Secure-better-auth.session_token"));
 if(PROTECTED.some(p=>path===p||path.startsWith(p+"/"))&&!authenticated){
  const dest=path.startsWith("/area-team")||path.startsWith("/admin")?"/accesso-team":path.startsWith("/partner")?"/accesso-partner":"/accedi";
  return NextResponse.redirect(new URL(dest,request.url));
 }
 const response=NextResponse.next();
 response.headers.set("Cache-Control","private, no-store");
 response.headers.set("Referrer-Policy","no-referrer");
 return response;
}
export const config={matcher:["/spazio/:path*","/area-autore/:path*","/area-team/:path*","/partner/:path*","/admin/:path*","/sicurezza/:path*"]};
