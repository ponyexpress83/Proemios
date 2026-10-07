import { ImageResponse } from "next/og";
import { BRAND } from "@/config/brand";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${BRAND.name} — ${BRAND.payoff}`;

/**
 * Immagine Open Graph: composta come la copertina di un libro.
 * Carta, rosso matita e inchiostro, coerenti con il sito pubblico.
 */
export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#FAFAF7",
        padding: "72px 80px",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#131936" }}>
          <span style={{ color: "#C8202A" }}>P</span>
          <span>roemios</span>
        </div>
        <div
          style={{
            display: "flex",
            height: 2,
            background: "#131936",
            opacity: 0.28,
            marginTop: 14,
            width: 220,
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            lineHeight: 1.08,
            color: "#131936",
            maxWidth: 900,
          }}
        >
          Dai forma alla tua storia.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            color: "#565B69",
            maxWidth: 820,
            lineHeight: 1.5,
          }}
        >
          Editing, impaginazione, copertina, EPUB, ISBN e pubblicazione su Amazon. Un interlocutore
          solo, dal manoscritto al libro pronto.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#C8202A",
          }}
        >
          {BRAND.payoff}
        </div>
        <div style={{ display: "flex", fontSize: 18, color: "#565B69" }}>{BRAND.domain}</div>
      </div>
    </div>,
    size,
  );
}
