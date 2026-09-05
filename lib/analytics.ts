/**
 * Eventi di navigazione verso il `dataLayer` di GTM.
 *
 * Da qui passano **solo** gli eventi che nascono nel browser. Gli eventi di
 * esito — un lead qualificato, una proposta inviata, un incasso — vivono sul
 * server e si registrano in `lib/dati/conversioni.ts`: vedi il commento in
 * `lib/analytics/eventi.ts` per il perché.
 */
import {
  payloadDataLayer,
  type EventoNavigazione,
  type ParametriEvento,
} from "@/lib/analytics/eventi";

export type { EventoNavigazione, EventoEsito, EventoConversione } from "@/lib/analytics/eventi";

/** Nome storico, mantenuto per i chiamanti esistenti. */
export type ConversionEvent = EventoNavigazione;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(event: EventoNavigazione, data: ParametriEvento = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(payloadDataLayer(event, data));
}
