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
        background: "#FAF8F5",
        borderRadius: 8,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 48 48">
        <path
          d="M10 37V9h13c10 0 16 6 16 14s-6 14-16 14H10Zm7-21v14h6c6 0 9-2 9-7s-3-7-9-7h-6Z"
          fill="#131936"
        />
        <path d="m10 37 7-7v10l-7 4Z" fill="#131936" />
        <path d="m21 19 6 4-6 4Z" fill="#F16650" />
      </svg>
    </div>,
    size,
  );
}
