/**
 * Branding white label.
 *
 * Questo modulo è il punto in cui dati scritti da un'agenzia diventano CSS e
 * markup nella pagina di un suo cliente. È quindi un confine di sicurezza, non
 * una questione di gusto:
 *
 *  - **un colore dev'essere un colore.** Un valore arbitrario in una `<style>`
 *    permette di chiudere la regola e aprirne altre: `red; } body { display:none`
 *    fa sparire la pagina, e cose peggiori sono possibili con `url()`;
 *  - **un logo dev'essere https e un'immagine.** Un `javascript:` in un `src`
 *    non esegue nulla nei browser moderni, ma un `data:` sì in altri contesti,
 *    e un logo servito da un dominio qualunque fa tracciare gli utenti da terzi
 *    a ogni caricamento di pagina;
 *  - **il nome visualizzato è testo**, e viene troncato: un "nome" di
 *    diecimila caratteri è un attacco all'impaginazione di chi lo riceve.
 *
 * Modulo puro: nessuna dipendenza, interamente testabile.
 */

export type Branding = {
  logoUrl?: string;
  coloreIdentita?: string;
  nomeVisualizzato?: string;
  dominio?: string;
  emailMittente?: string;
  firmaEmail?: string;
};

/** Colore esadecimale a 3, 6 o 8 cifre. Niente `rgb()`, niente nomi, niente altro. */
const COLORE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const LUNGHEZZE = {
  nomeVisualizzato: 60,
  firmaEmail: 500,
  dominio: 253,
  emailMittente: 320,
} as const;

export type EsitoBranding = { ok: true; branding: Branding } | { ok: false; motivo: string };

/**
 * Valida e normalizza il branding.
 *
 * Restituisce l'oggetto ripulito invece di modificare quello ricevuto: ciò che
 * viene scritto in database è ciò che è passato dai controlli, non l'input con
 * accanto una promessa che sia stato controllato.
 */
export function brandingValido(branding: Branding): EsitoBranding {
  const pulito: Branding = {};

  if (branding.coloreIdentita !== undefined && branding.coloreIdentita !== "") {
    const colore = branding.coloreIdentita.trim();
    if (!COLORE.test(colore)) {
      return {
        ok: false,
        motivo: "Il colore dev'essere esadecimale, per esempio #6c4bff.",
      };
    }
    pulito.coloreIdentita = colore.toLowerCase();
  }

  if (branding.logoUrl !== undefined && branding.logoUrl !== "") {
    const esito = urlLogoValido(branding.logoUrl.trim());
    if (!esito.ok) return { ok: false, motivo: esito.motivo };
    pulito.logoUrl = esito.url;
  }

  if (branding.nomeVisualizzato) {
    const nome = branding.nomeVisualizzato.trim().slice(0, LUNGHEZZE.nomeVisualizzato);
    if (!nome) return { ok: false, motivo: "Il nome visualizzato non può essere vuoto." };
    pulito.nomeVisualizzato = nome;
  }

  if (branding.dominio) {
    const dominio = branding.dominio.trim().toLowerCase().slice(0, LUNGHEZZE.dominio);
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(dominio)) {
      return { ok: false, motivo: "Il dominio non è valido." };
    }
    pulito.dominio = dominio;
  }

  if (branding.emailMittente) {
    const email = branding.emailMittente.trim().slice(0, LUNGHEZZE.emailMittente);
    // Volutamente semplice: la verifica vera è che il dominio sia configurato
    // sul provider di posta, e quella non si fa con un'espressione regolare.
    if (!/^[^\s@<>]+@[^\s@<>.]+(\.[^\s@<>.]+)+$/.test(email)) {
      return { ok: false, motivo: "L'indirizzo del mittente non è valido." };
    }
    pulito.emailMittente = email;
  }

  if (branding.firmaEmail) {
    pulito.firmaEmail = branding.firmaEmail.trim().slice(0, LUNGHEZZE.firmaEmail);
  }

  return { ok: true, branding: pulito };
}

function urlLogoValido(grezzo: string): { ok: true; url: string } | { ok: false; motivo: string } {
  let url: URL;
  try {
    url = new URL(grezzo);
  } catch {
    return { ok: false, motivo: "L'indirizzo del logo non è un URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, motivo: "Il logo dev'essere servito in https." };
  }
  if (url.username || url.password) {
    return { ok: false, motivo: "L'indirizzo del logo non può contenere credenziali." };
  }
  return { ok: true, url: url.toString() };
}

/**
 * Le variabili CSS che sovrascrivono l'identità, come oggetto di stile.
 *
 * Si restituisce un **oggetto**, non una stringa da mettere in un `<style>`.
 * La differenza è di sicurezza: un oggetto passato a `style` finisce in
 * `CSSStyleDeclaration.setProperty`, che rifiuta i valori malformati e non può
 * chiudere una regola per aprirne un'altra. Un `<style>` costruito per
 * concatenazione, invece, avrebbe richiesto anche di rendere sicuro il
 * selettore, e ogni pezzo concatenato è un pezzo che si può sbagliare.
 *
 * Il valore è già passato da `brandingValido`, ma la funzione **ricontrolla**:
 * è l'ultima riga prima che una stringa diventi CSS, e un controllo in più
 * costa niente rispetto a fidarsi che il chiamante abbia fatto il suo.
 */
export function variabiliStile(branding: Branding | null | undefined): Record<string, string> {
  const colore = branding?.coloreIdentita;
  if (!colore || !COLORE.test(colore)) return {};
  return { "--color-viola": colore, "--color-viola-chiaro": colore };
}

/**
 * Il nome da mostrare.
 *
 * Quando `proemiosInvisibile` è vero il marchio Proemios non compare in niente
 * di ciò che l'agenzia vede o inoltra: è la promessa commerciale del white
 * label, e va mantenuta anche nei posti che sembrano innocui — il titolo di una
 * pagina, l'oggetto di un'email, il piè di pagina di un PDF.
 */
export function nomeVisibile(
  branding: Branding | null | undefined,
  proemiosInvisibile: boolean,
  predefinito: string,
): string {
  if (branding?.nomeVisualizzato) return branding.nomeVisualizzato;
  return proemiosInvisibile ? "" : predefinito;
}
