import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { SERVICES } from "@/config/services";
import { CASE_STUDIES } from "@/config/caseStudies";
import { BLOG_POSTS } from "@/config/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  const staticPaths = [
    "",
    "/servizi",
    "/dal-diario-al-libro",
    "/per-agenzie",
    "/casi-studio",
    "/preventivo",
    "/analisi-manoscritto",
    "/blog",
    "/contatti",
    "/privacy",
    "/termini",
  ];

  const entries: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.7,
  }));

  for (const s of SERVICES) {
    entries.push({ url: `${base}/servizi/${s.slug}`, changeFrequency: "monthly", priority: 0.8 });
  }
  for (const c of CASE_STUDIES) {
    entries.push({
      url: `${base}/casi-studio/${c.slug}`,
      changeFrequency: "yearly",
      priority: 0.5,
    });
  }
  for (const p of BLOG_POSTS) {
    entries.push({ url: `${base}/blog/${p.slug}`, changeFrequency: "monthly", priority: 0.6 });
  }

  return entries;
}
