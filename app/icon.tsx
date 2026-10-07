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
        background: "#FAFAF7",
        borderRadius: 8,
      }}
    >
      <svg width="28" height="28" viewBox="0 0 52 52">
        <path d={`${BRAND_MARK.body} ${BRAND_MARK.counter}`} fill="#131936" fillRule="evenodd" />
        <path d={BRAND_MARK.fold} fill="#C8202A" />
      </svg>
    </div>,
    size,
  );
}
