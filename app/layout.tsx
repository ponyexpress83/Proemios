import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { UI } from "@/config/copy";
import { fontVariables } from "./fonts";
import { Testata } from "@/components/layout/testata";
import { Colophon } from "@/components/layout/colophon";
import { FasciaDemo } from "@/components/layout/fascia-demo";
import { AttributionCapture } from "@/components/marketing/attribution-capture";
import { demoAttiva } from "@/lib/demo";
import { JsonLd, organizationJsonLd } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: {
    default: `${BRAND.name} — ${BRAND.payoff}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: BRAND.url,
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.payoff}`,
    description: BRAND.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.payoff}`,
    description: BRAND.description,
  },
  alternates: { canonical: BRAND.url },
  // La demo resta fuori dall'indice: vedi anche app/robots.ts.
  robots: demoAttiva() ? { index: false, follow: false } : { index: true, follow: true },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <JsonLd data={organizationJsonLd()} />
        <AttributionCapture />
        <a
          href="#contenuto"
          className="focus:rounded-campo focus:bg-alloro focus:text-carta sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2"
        >
          {UI.saltaAlContenuto}
        </a>
        <FasciaDemo />
        <Testata />
        <main id="contenuto" className="flex-1">
          {children}
        </main>
        <Colophon />
      </body>
    </html>
  );
}
