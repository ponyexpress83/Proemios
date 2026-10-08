import { NextResponse, type NextRequest } from "next/server";

export function middleware(request:NextRequest){
  if(!request.cookies.get("better-auth.session_token") && !request.cookies.get("__Secure-better-auth.session_token")){const url=new URL("/accedi",request.url);return NextResponse.redirect(url);}
  const response=NextResponse.next();response.headers.set("Cache-Control","private, no-store");response.headers.set("Referrer-Policy","no-referrer");return response;
}
export const config={matcher:["/spazio/:path*","/area-autore/:path*","/area-team/:path*","/admin/:path*","/sicurezza/:path*"]};
