import { ImageResponse } from "next/og";
import { BRAND_MARK } from "@/lib/brand-mark";
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
      <svg width="28" height="28" viewBox="0 0 52 52">
        <path d={BRAND_MARK.body} fill="#131936" />
        <path d={BRAND_MARK.counter} fill="#FAF8F5" />
        <path d={BRAND_MARK.fold} fill="#F16650" />
      </svg>
    </div>,
    size,
  );
}
