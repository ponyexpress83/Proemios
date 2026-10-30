import type { Metadata } from "next";
import { demoAttiva } from "@/lib/demo";
import { BRAND } from "@/config/brand";
import { TITOLARE } from "@/config/legal";

/** Un'unica origine configurata, mai il dominio temporaneo di un deploy. */
export function assoluto(path = "/"): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || BRAND.url;
  const base = new URL(configured).origin;
  if (new URL(base).protocol !== "https:" || new URL(base).hostname !== "proemios.it") throw new Error("NEXT_PUBLIC_SITE_URL deve essere https://proemios.it.");
  return `${base}${path === "/" ? "" : path}`;
}
export function indicizzazioneBloccata(): boolean {
  return demoAttiva() || process.env.VERCEL_ENV !== "production" || process.env.PROEMIOS_PRODUCTION_READY !== "1";
}

/** Metadata di pagina con canonical, Open Graph e Twitter coerenti. */
export function metadatiPagina({
  titolo,
  descrizione,
  path = "/",
  noindex = false,
  tipo = "website",
}: {
  titolo: string;
  descrizione: string;
  path?: string;
  noindex?: boolean;
  tipo?: "website" | "article";
}): Metadata {
  const url = assoluto(path);
  const titoloCompleto =
    path === "/" ? `${BRAND.name} — ${BRAND.payoff}` : `${titolo} · ${BRAND.name}`;
  return {
    title: titolo,
    description: descrizione,
    alternates: { canonical: url },
    robots:
      noindex || indicizzazioneBloccata()
        ? { index: false, follow: false }
        : { index: true, follow: true },
    openGraph: {
      type: tipo,
      locale: "it_IT",
      url,
      siteName: BRAND.name,
      title: titoloCompleto,
      description: descrizione,
    },
    twitter: { card: "summary_large_image", title: titoloCompleto, description: descrizione },
  };
}

// ── JSON-LD (Schema.org) ───────────────────────────────────────────────────

type Json = Record<string, unknown>;

export function organizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: assoluto("/"),
    email: BRAND.email.general,
    slogan: BRAND.payoff,
    description: BRAND.description,
    areaServed: "IT",
    knowsLanguage: ["it"],
    vatID: TITOLARE.partitaIva,
    taxID: TITOLARE.codiceFiscale,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Via Girardengo 5",
      postalCode: "58100",
      addressLocality: "Grosseto",
      addressRegion: "GR",
      addressCountry: "IT",
    },
  };
}

export function serviceJsonLd(params: {
  nome: string;
  descrizione: string;
  slug: string;
  path?: string;
  prezzo?: { min: number; max: number } | null;
}): Json {
  const base: Json = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: params.nome,
    description: params.descrizione,
    provider: { "@type": "Organization", name: BRAND.name, url: assoluto("/") },
    areaServed: "IT",
    url: assoluto(params.path ?? `/servizi/${params.slug}`),
  };
  if (params.prezzo) {
    base.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: params.prezzo.min,
      highPrice: params.prezzo.max,
    };
  }
  return base;
}

export function faqJsonLd(voci: { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: voci.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function articleJsonLd(params: {
  titolo: string;
  descrizione: string;
  slug: string;
  sezione?: string;
  data?: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: params.titolo,
    description: params.descrizione,
    articleSection: params.sezione,
    datePublished: params.data,
    author: { "@type": "Organization", name: BRAND.name },
    publisher: { "@type": "Organization", name: BRAND.name },
    url: assoluto(`/blog/${params.slug}`),
    inLanguage: "it",
  };
}

export function breadcrumbJsonLd(voci: { nome: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: voci.map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: v.nome,
      item: assoluto(v.path),
    })),
  };
}

/** Inietta JSON-LD. I dati sono generati server-side da sorgenti interne. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
