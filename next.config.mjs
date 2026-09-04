/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Rotte tipizzate: un link a una pagina inesistente rompe la build, non la produzione.
  typedRoutes: true,
  // mammoth e pdf-parse girano solo server-side: fuori dal bundle client.
  serverExternalPackages: ["mammoth", "pdf-parse"],

  /**
   * I sei pacchetti pre-catalogo erano indicizzati con questi URL. Il catalogo
   * a due livelli li ha sostituiti: un 301 verso il percorso o il servizio
   * equivalente conserva il posizionamento invece di produrre 404.
   */
  async redirects() {
    return [
      { source: "/servizi/valutazione-editoriale", destination: "/servizi/scheda-valutazione-editoriale", permanent: true },
      { source: "/servizi/revisione-e-pubblicazione", destination: "/percorsi/ho-gia-scritto-il-libro", permanent: true },
      { source: "/servizi/dal-diario-al-libro", destination: "/percorsi/memoir-e-storia-familiare", permanent: true },
      { source: "/servizi/libro-per-professionisti", destination: "/percorsi/libro-professionale", permanent: true },
      { source: "/servizi/copertina-e-impaginazione", destination: "/percorsi/voglio-pubblicare", permanent: true },
      { source: "/servizi/partner-white-label", destination: "/percorsi/agenzie-e-white-label", permanent: true },
      { source: "/dal-diario-al-libro", destination: "/percorsi/memoir-e-storia-familiare", permanent: true },
      { source: "/libro-per-professionisti", destination: "/percorsi/libro-professionale", permanent: true },
    ];
  },
};

export default nextConfig;
