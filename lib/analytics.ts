export type ConversionEvent =
  | "quote_generated"
  | "consultation_clicked"
  | "checkout_started"
  | "manuscript_analysis_completed"
  | "lead_submitted";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(event: ConversionEvent, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...data });
}
