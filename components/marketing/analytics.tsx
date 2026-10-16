"use client";
import { useEffect, useState } from "react";
import Script from "next/script";
import { readConsent, writeConsent, trackEvent, type ConsentState } from "@/lib/analytics";

/**
 * GA4 con Consent Mode v2 in modalità di base: lo script si carica solo
 * dopo un consenso esplicito (nessuna preselezione, rifiuto con un clic,
 * revoca da /cookie). Senza ID di misurazione non viene mostrato nulla.
 */
export function Analytics({ measurementId }: { measurementId?: string }) {
  const [consent, setConsent] = useState<ConsentState | null | undefined>(undefined);
  useEffect(() => { setConsent(readConsent()); }, []);
  if (!measurementId || !/^G-[A-Z0-9]{4,20}$/.test(measurementId) || consent === undefined) return null;
  const decide = (analytics: boolean) => setConsent(writeConsent(analytics));
  return (
    <>
      {consent?.analytics ? (
        <>
          <Script id="ga4-consent" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'granted'});gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}</Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
        </>
      ) : null}
      {consent === null ? (
        <div role="dialog" aria-label="Statistiche di utilizzo" className="proemios-consent" style={{ position: "fixed", insetInline: 16, bottom: 16, zIndex: 90, maxWidth: 560, margin: "0 auto", background: "#fffdf8", color: "#1b1a17", border: "1px solid #d8d3c6", borderRadius: 12, padding: "16px 20px", boxShadow: "0 8px 30px rgba(0,0,0,.12)", fontSize: 15 }}>
          <p style={{ margin: "0 0 12px" }}>Possiamo usare Google Analytics per capire quali pagine aiutano davvero? Nessuna pubblicità, nessun dato personale negli eventi; puoi cambiare idea in qualsiasi momento dalla pagina <a href="/cookie">Cookie</a>.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => decide(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1b1a17", background: "transparent" }}>No, grazie</button>
            <button type="button" onClick={() => decide(true)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #22483b", background: "#22483b", color: "#fff" }}>Accetto le statistiche</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
/** Evento di acquisto dopo la conferma verificata sul server: id dell'ordine, mai dati personali. */
export function PurchaseEvent({ orderId, valueCents, kind }: { orderId: string; valueCents: number; kind: string }) {
  useEffect(() => { trackEvent("purchase", { transaction_id: orderId, value: valueCents / 100, currency: "EUR", kind }); }, [orderId, valueCents, kind]);
  return null;
}
/** Revoca o modifica del consenso dalla pagina Cookie. */
export function ConsentControls() {
  const [consent, setConsent] = useState<ConsentState | null | undefined>(undefined);
  useEffect(() => { setConsent(readConsent()); }, []);
  if (consent === undefined) return null;
  return (
    <p>
      Statistiche: {consent?.analytics ? "attive" : "non attive"}.{" "}
      <button type="button" className="underline" onClick={() => setConsent(writeConsent(!consent?.analytics))}>{consent?.analytics ? "Disattiva" : "Attiva"}</button>
    </p>
  );
}
