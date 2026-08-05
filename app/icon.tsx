import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Icona: la P del marchio, ottone su inchiostro. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1B1A17",
        color: "#9C7A3D",
        fontSize: 24,
        fontWeight: 600,
        fontFamily: "Georgia, serif",
      }}
    >
      P
    </div>,
    size,
  );
}
