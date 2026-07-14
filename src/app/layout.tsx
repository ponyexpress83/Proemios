import type { Metadata } from "next";
import { fraunces, inter } from "./fonts";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SITE } from "@/config/site";
import { siteUrl } from "@/lib/env";
import { JsonLd, organizationJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE.nome} — ${SITE.tagline}`,
    template: `%s · ${SITE.nome}`,
  },
  description: SITE.descrizione,
  applicationName: SITE.nome,
  authors: [{ name: SITE.nome }],
  creator: SITE.nome,
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: SITE.nome,
  },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <JsonLd data={organizationJsonLd()} />
        <a
          href="#contenuto"
          className="focus:bg-inchiostro focus:text-carta sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2"
        >
          Vai al contenuto
        </a>
        <Navbar />
        <main id="contenuto" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
