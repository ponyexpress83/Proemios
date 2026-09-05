/**
 * Intestazioni di sicurezza.
 *
 * La Content-Security-Policy è costruita con un **nonce per richiesta**: è
 * l'unico modo di permettere gli script inline che Next.js genera senza aprire
 * la porta a `unsafe-inline`, che vanificherebbe la policy — con
 * `unsafe-inline` attivo, uno script iniettato in pagina viene eseguito
 * esattamente come i nostri.
 *
 * In sviluppo la policy è più larga: il refresh di Next valuta codice a runtime
 * e senza `unsafe-eval` la pagina non si aggiorna. Quella larghezza non deve
 * arrivare in produzione, e infatti dipende da `NODE_ENV`, non da una variabile
 * che qualcuno possa impostare per errore.
 */

export type OpzioniCsp = {
  nonce: string;
  sviluppo: boolean;
  /** Ammette Google Tag Manager e i domini che carica. */
  gtm?: boolean;
  /** Dominio dell'analytics senza cookie, quando configurato. */
  analytics?: string;
};

/**
 * Costruisce la CSP.
 *
 * Le scelte che vale la pena spiegare:
 *
 *  - `frame-ancestors 'none'`: nessuno può mettere il prodotto in un iframe.
 *    Sostituisce `X-Frame-Options`, che resta comunque per i browser che
 *    leggono solo quello.
 *  - `object-src 'none'`: non usiamo plugin, e ammetterli è un rischio senza
 *    contropartita.
 *  - `base-uri 'self'`: un `<base>` iniettato riscriverebbe ogni URL relativo
 *    della pagina, comprese le destinazioni delle form.
 *  - `form-action 'self'`: una form riscritta non può inviare altrove i dati
 *    che l'utente sta dando a noi.
 *  - `upgrade-insecure-requests` solo in produzione: in sviluppo si lavora in
 *    http su localhost.
 */
export function costruisciCsp(opzioni: OpzioniCsp): string {
  const script = [
    "'self'",
    `'nonce-${opzioni.nonce}'`,
    // `strict-dynamic` fa sì che uno script fidato possa caricarne altri: è ciò
    // che permette a GTM di funzionare senza elencare a mano i domini dei tag,
    // che cambiano senza preavviso.
    "'strict-dynamic'",
    // Ignorati dai browser che capiscono strict-dynamic; servono ai più vecchi.
    "https:",
    opzioni.sviluppo ? "'unsafe-eval'" : "",
  ].filter(Boolean);

  const connect = [
    "'self'",
    opzioni.gtm ? "https://*.google-analytics.com https://*.googletagmanager.com" : "",
    opzioni.analytics ? `https://${opzioni.analytics}` : "",
    "https://api.stripe.com",
    opzioni.sviluppo ? "ws: http://localhost:*" : "",
  ].filter(Boolean);

  const direttive: Record<string, string> = {
    "default-src": "'self'",
    "script-src": script.join(" "),
    // Gli stili inline sono inevitabili: React scrive le variabili di branding
    // nell'attributo `style`, e un nonce non copre gli attributi.
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob: https:",
    "font-src": "'self' data:",
    "connect-src": connect.join(" "),
    "frame-src": "https://js.stripe.com https://hooks.stripe.com",
    "frame-ancestors": "'none'",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "worker-src": "'self' blob:",
    "manifest-src": "'self'",
  };

  const righe = Object.entries(direttive).map(([k, v]) => `${k} ${v}`);
  if (!opzioni.sviluppo) righe.push("upgrade-insecure-requests");
  return righe.join("; ");
}

/**
 * Le intestazioni che non dipendono dalla richiesta.
 *
 * `Strict-Transport-Security` si emette solo in produzione: in sviluppo
 * bloccherebbe `http://localhost` nel browser per i mesi successivi, e disfarlo
 * richiede di andare nelle impostazioni interne del browser.
 */
export function intestazioniFisse(sviluppo: boolean): Record<string, string> {
  const intestazioni: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    // `strict-origin-when-cross-origin` manda l'origine ma non il percorso ai
    // domini esterni: un referer completo rivelerebbe quali pagine private
    // qualcuno stava guardando.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "X-DNS-Prefetch-Control": "off",
    "Cross-Origin-Opener-Policy": "same-origin",
  };

  if (!sviluppo) {
    intestazioni["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return intestazioni;
}

/** Nonce casuale per una richiesta. Usa la Web Crypto, disponibile sull'edge. */
export function generaNonce(): string {
  const byte = new Uint8Array(16);
  crypto.getRandomValues(byte);
  return btoa(String.fromCharCode(...byte));
}
