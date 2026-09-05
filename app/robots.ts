import type { MetadataRoute } from "next";
import { demoAttiva } from "@/lib/demo";
import { assoluto } from "@/lib/seo";

/**
 * In modalità demo il sito è chiuso ai motori: una copia dimostrativa su un
 * dominio di anteprima non va indicizzata, e non deve competere con il sito
 * vero per le stesse pagine.
 *
 * Valutato a ogni richiesta e non al build: se questo file venisse congelato in
 * statico, un deploy fatto prima di configurare il database continuerebbe a
 * servire un `Disallow: /` anche dopo il passaggio in produzione — un errore
 * silenzioso che costerebbe settimane di indicizzazione.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (demoAttiva()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Ogni area riservata: sono già `noindex` nei metadata e protette lato
      // server, ma un crawler che le prova genera 401 nei log e spreca il
      // budget di scansione su pagine che non vedrà mai.
      disallow: ["/admin", "/area", "/redazione", "/accedi", "/api/"],
    },
    sitemap: assoluto("/sitemap.xml"),
    host: assoluto("/"),
  };
}
