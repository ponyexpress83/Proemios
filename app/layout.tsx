import type { Metadata } from "next";
import Script from "next/script";
import { headers } from "next/headers";
import { BRAND } from "@/config/brand";
import { UI } from "@/config/copy";
import { PRELOAD_FONT } from "./fonts";
import { AttributionCapture } from "@/components/marketing/attribution-capture";
import { demoAttiva } from "@/lib/demo";
import { JsonLd, organizationJsonLd } from "@/lib/seo";
import "./globals.css";
import "./editorial.css";

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
  robots: demoAttiva() ? { index: false, follow: false } : { index: true, follow: true },
  icons: {icon: "/favicon.svg", shortcut: "/favicon.svg"},
  formatDetection: { telephone: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID?.trim();
  // Il nonce lo genera il middleware, uno per richiesta: senza, lo script di
  // GTM verrebbe bloccato dalla CSP invece di caricarsi silenziosamente.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="it">
      <head>
        {/* Solo le facce sopra la piega. Le altre arrivano con `font-display: swap`
            quando servono. Dichiarato a mano perché Next, con un layout dinamico,
            lascia i suggerimenti di preload nel flusso RSC e non nell'HTML. */}
        {PRELOAD_FONT.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
      </head>
      <body className="flex min-h-dvh flex-col">
        {gtmId && !demoAttiva() && (
          <>
            <Script id="gtm-init" strategy="afterInteractive" nonce={nonce}>
              {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
            </Script>
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
                title="Google Tag Manager"
              />
            </noscript>
          </>
        )}
        <JsonLd data={organizationJsonLd()} />
        <AttributionCapture />
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:bg-lime focus:px-4 focus:py-2 focus:font-medium focus:text-fondo"
        >
          {UI.saltaAlContenuto}
        </a>
        {children}
      </body>
    </html>
  );
}
