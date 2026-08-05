/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Rotte tipizzate: un link a una pagina inesistente rompe la build, non la produzione.
  typedRoutes: true,
  // mammoth e pdf-parse girano solo server-side: fuori dal bundle client.
  serverExternalPackages: ["mammoth", "pdf-parse"],
};

export default nextConfig;
