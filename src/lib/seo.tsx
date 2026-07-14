import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { siteUrl } from "@/lib/env";

/** Costruisce i metadata di pagina con Open Graph e Twitter coerenti. */
export function pageMetadata({
  title,
  description,
  path = "/",
  noindex = false,
}: {
  title: string;
  description: string;
  path?: string;
  noindex?: boolean;
}): Metadata {
  const url = `${siteUrl()}${path}`;
  const fullTitle = path === "/" ? `${SITE.nome} — ${SITE.tagline}` : `${title} · ${SITE.nome}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      locale: "it_IT",
      url,
      siteName: SITE.nome,
      title: fullTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}

// ─── JSON-LD (Schema.org) ────────────────────────────────────────────────────

type Json = Record<string, unknown>;

export function organizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.nome,
    url: siteUrl(),
    email: SITE.email,
    description: SITE.descrizione,
    areaServed: "IT",
    knowsLanguage: ["it"],
    slogan: SITE.tagline,
  };
}

export function serviceJsonLd(params: {
  name: string;
  description: string;
  slug: string;
  price?: { min: number; max: number } | null;
}): Json {
  const base: Json = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: params.name,
    description: params.description,
    provider: { "@type": "Organization", name: SITE.nome, url: siteUrl() },
    areaServed: "IT",
    url: `${siteUrl()}/servizi/${params.slug}`,
  };
  if (params.price) {
    base.offers = {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: params.price.min,
      highPrice: params.price.max,
    };
  }
  return base;
}

export function faqJsonLd(items: { domanda: string; risposta: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.domanda,
      acceptedAnswer: { "@type": "Answer", text: f.risposta },
    })),
  };
}

export function articleJsonLd(params: {
  title: string;
  description: string;
  slug: string;
  section?: string;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: params.title,
    description: params.description,
    articleSection: params.section,
    author: { "@type": "Organization", name: SITE.nome },
    publisher: { "@type": "Organization", name: SITE.nome },
    url: `${siteUrl()}/blog/${params.slug}`,
    inLanguage: "it",
  };
}

/** Componente per iniettare JSON-LD in modo sicuro. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      // I dati sono generati server-side da sorgenti interne (nessun input utente).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
