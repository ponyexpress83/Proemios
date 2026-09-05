import type { MetadataRoute } from "next";
import { SLUG_SERVIZI } from "@/config/catalogo";
import { SLUG_PERCORSI } from "@/config/percorsi";
import { CASE_STUDIES } from "@/config/case-studies";
import { tuttiGliArticoli } from "@/lib/blog";
import { assoluto } from "@/lib/seo";

/**
 * Sitemap dinamica.
 * Non include ciò che è escluso dall'indicizzazione: `/admin`, le API, la
 * pagina di conferma acconto e gli articoli ancora in redazione
 * (`pubblicato: false`, che sono già `noindex`).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const statiche: {
    path: string;
    priorita: number;
    frequenza: "weekly" | "monthly" | "yearly";
  }[] = [
    { path: "", priorita: 1, frequenza: "weekly" },
    { path: "/servizi", priorita: 0.9, frequenza: "monthly" },
    { path: "/percorsi", priorita: 0.9, frequenza: "monthly" },
    { path: "/preventivo", priorita: 0.9, frequenza: "monthly" },
    { path: "/analisi-manoscritto", priorita: 0.9, frequenza: "monthly" },
    { path: "/per-agenzie", priorita: 0.8, frequenza: "monthly" },
    { path: "/strumenti-ai", priorita: 0.8, frequenza: "monthly" },
    { path: "/come-funziona", priorita: 0.7, frequenza: "monthly" },
    { path: "/casi-studio", priorita: 0.6, frequenza: "monthly" },
    { path: "/blog", priorita: 0.6, frequenza: "weekly" },
    { path: "/chi-siamo", priorita: 0.6, frequenza: "yearly" },
    { path: "/contatti", priorita: 0.6, frequenza: "monthly" },
    { path: "/privacy", priorita: 0.3, frequenza: "yearly" },
    { path: "/termini", priorita: 0.3, frequenza: "yearly" },
    { path: "/cookie", priorita: 0.3, frequenza: "yearly" },
  ];

  const voci: MetadataRoute.Sitemap = statiche.map((s) => ({
    url: assoluto(s.path),
    lastModified: now,
    changeFrequency: s.frequenza,
    priority: s.priorita,
  }));

  for (const slug of SLUG_PERCORSI) {
    voci.push({
      url: assoluto(`/percorsi/${slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    });
  }

  for (const slug of SLUG_SERVIZI) {
    voci.push({
      url: assoluto(`/servizi/${slug}`),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  for (const caso of CASE_STUDIES) {
    voci.push({
      url: assoluto(`/casi-studio/${caso.slug}`),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }

  // Solo gli articoli effettivamente pubblicati.
  for (const articolo of tuttiGliArticoli().filter((a) => a.pubblicato)) {
    voci.push({
      url: assoluto(`/blog/${articolo.slug}`),
      lastModified: articolo.dataPubblicazione ? new Date(articolo.dataPubblicazione) : now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return voci;
}
