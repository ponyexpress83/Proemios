/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() { return [{source:"/:path*",headers:[{key:"Content-Security-Policy",value:"default-src 'self'; script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "") + "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'" + (process.env.NODE_ENV === "development" ? " ws:" : "") + "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'none'"},{key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"DENY"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"}]},...['accedi','registrati','accesso-team','recupera-accesso','nuova-password','verifica-accesso','invito','collega-preventivo','sicurezza','spazio'].map(path=>({source:`/${path}/:path*`,headers:[{key:"Cache-Control",value:"private, no-store"},{key:"Referrer-Policy",value:"no-referrer"},{key:"X-Robots-Tag",value:"noindex, nofollow"}]}))]; },
  reactStrictMode: true,
  poweredByHeader: false,
  // Rotte tipizzate: un link a una pagina inesistente rompe la build, non la produzione.
  typedRoutes: true,
  // mammoth e pdf-parse girano solo server-side: fuori dal bundle client.
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
