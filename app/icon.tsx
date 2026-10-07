import { ImageResponse } from "next/og";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FAFAF7",
        borderRadius: 8,
      }}
    >
      <svg width="26" height="26" viewBox="0 0 32 32">
        <path d="M5 7c5 0 8 3 11 7 3-4 6-7 11-7v17c-5 0-8 1-11 4-3-3-6-4-11-4Z" fill="#C8202A" />
        <path d="M16 14v14" stroke="#fff" strokeWidth="1.5" />
      </svg>
    </div>,
    size,
  );
}
