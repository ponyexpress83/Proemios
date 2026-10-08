import type { Metadata } from "next";

import { BRAND } from "@/config/brand";
import { UI } from "@/config/copy";
import { SiteChrome } from "@/components/editorial/site-chrome";

import { FasciaDemo } from "@/components/layout/fascia-demo";
import { analysisConfigured } from "@/lib/platform/analysis";


import { JsonLd, organizationJsonLd, assoluto, indicizzazioneBloccata } from "@/lib/seo";
import "./globals.css";
import "./editorial.css";
import "./experience.css";
import "./refinements.css";
import "./platform.css";

export const metadata: Metadata = {
  metadataBase: new URL(assoluto()),
  title: {
    default: `${BRAND.name} — ${BRAND.payoff}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: assoluto(),
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.payoff}`,
    description: BRAND.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.payoff}`,
    description: BRAND.description,
  },
  alternates: { canonical: assoluto() },
  robots: indicizzazioneBloccata()
    ? { index: false, follow: false }
    : { index: true, follow: true },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {


  return (
    <html lang="it">
      <head>
        <link
          rel="preload"
          href="/fonts/editorial.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-dvh flex-col">
        <JsonLd data={organizationJsonLd()} />
        <a
          href="#contenuto"
          className="focus:rounded-campo focus:bg-alloro focus:text-carta sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2"
        >
          {UI.saltaAlContenuto}
        </a>
        <FasciaDemo />
        <SiteChrome analysisReady={analysisConfigured()}>{children}</SiteChrome>
      </body>
    </html>
  );
}
