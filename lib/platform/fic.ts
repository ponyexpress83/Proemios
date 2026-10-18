/**
 * Client minimo per l'API v2 di Fatture in Cloud. Serve a una cosa sola:
 * emettere la fattura di un incasso confermato e restituirne il PDF.
 *
 * Variabili d'ambiente:
 * - FIC_ACCESS_TOKEN: token manuale o OAuth con ambiti "issued_documents.invoices:a".
 * - FIC_COMPANY_ID: id dell'azienda su Fatture in Cloud.
 * - FIC_SEND_TO_SDI: "1" invia subito la fattura allo SdI; altrimenti resta
 *   in Fatture in Cloud da inviare a mano (utile per i primi controlli).
 * - FIC_VAT_ID: id dell'aliquota in Fatture in Cloud (0 = 22% nei conti standard).
 * - FIC_VAT_ID_EXEMPT: id dell'aliquota per operazioni esenti, se usata.
 * - FIC_PAYMENT_ACCOUNT_ID: conto d'incasso (es. "Stripe") su cui registrare il saldo.
 */
import { PlatformError } from "./http";
const BASE = "https://api-v2.fattureincloud.it";
export function ficConfigured(): boolean {
  return Boolean(process.env.FIC_ACCESS_TOKEN && process.env.FIC_COMPANY_ID);
}
export function ficSendsToSdi(): boolean {
  return process.env.FIC_SEND_TO_SDI === "1";
}
async function call<T>(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> {
  if (!ficConfigured()) throw new PlatformError(503, "FIC_NOT_CONFIGURED", "Fatturazione non configurata.");
  const response = await fetch(`${BASE}/c/${process.env.FIC_COMPANY_ID}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.FIC_ACCESS_TOKEN}`,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const text = (await response.text().catch(() => "")).slice(0, 1000);
    throw new PlatformError(502, "FIC_ERROR", `Fatture in Cloud ${response.status}: ${text || response.statusText}`);
  }
  return (init.raw ? response : response.json()) as Promise<T>;
}
/**
 * Verifica il collegamento senza emettere nulla: azienda raggiungibile,
 * aliquote e conti d'incasso disponibili. Ogni voce riporta il proprio errore
 * (per esempio un ambito mancante nel token) senza bloccare le altre.
 */
export type FicProbe = {
  company: { id: number; name: string } | null;
  companies: Array<{ id: number; name: string }>;
  vatTypes: Array<{ id: number; value: number; description: string; isDefault: boolean }>;
  paymentAccounts: Array<{ id: number; name: string }>;
  errors: Record<string, string>;
};
export async function ficProbe(): Promise<FicProbe> {
  const probe: FicProbe = { company: null, companies: [], vatTypes: [], paymentAccounts: [], errors: {} };
  if (!ficConfigured()) {
    probe.errors.config = "FIC_ACCESS_TOKEN o FIC_COMPANY_ID mancanti.";
    return probe;
  }
  const companyId = Number(process.env.FIC_COMPANY_ID);
  const headers = { authorization: `Bearer ${process.env.FIC_ACCESS_TOKEN}`, accept: "application/json" };
  const read = async (path: string) => {
    const response = await fetch(`${BASE}${path}`, { headers, cache: "no-store" });
    if (!response.ok) {
      const text = (await response.text().catch(() => "")).slice(0, 300);
      throw new Error(`${response.status}: ${text || response.statusText}`);
    }
    return response.json() as Promise<{ data: unknown }>;
  };
  const message = (error: unknown) => (error instanceof Error ? error.message : "errore");
  try {
    const result = await read("/user/companies");
    const list = ((result.data as { companies?: Array<{ id: number; name: string }> })?.companies ?? []).map((c) => ({ id: c.id, name: c.name }));
    probe.companies = list;
    probe.company = list.find((c) => c.id === companyId) ?? null;
    if (!probe.company) probe.errors.company = `L'azienda ${companyId} non è tra quelle del token (${list.map((c) => `${c.id} ${c.name}`).join(", ") || "nessuna"}).`;
  } catch (error) {
    probe.errors.company = message(error);
  }
  try {
    const result = await read(`/c/${companyId}/info/vat_types`);
    probe.vatTypes = ((result.data as Array<{ id: number; value: number; description?: string; is_default?: boolean }>) ?? []).map((v) => ({ id: v.id, value: v.value, description: v.description ?? "", isDefault: Boolean(v.is_default) }));
  } catch (error) {
    probe.errors.vatTypes = message(error);
  }
  try {
    const result = await read(`/c/${companyId}/info/payment_accounts`);
    probe.paymentAccounts = ((result.data as Array<{ id: number; name: string }>) ?? []).map((a) => ({ id: a.id, name: a.name }));
  } catch (error) {
    probe.errors.paymentAccounts = message(error);
  }
  return probe;
}
export type FicEntity = {
  name: string;
  tax_code?: string;
  vat_number?: string;
  address_street: string;
  address_postal_code: string;
  address_city: string;
  address_province?: string;
  country: string;
  country_iso: string;
  email?: string;
  certified_email?: string;
  ei_code?: string;
};
export type FicInvoiceInput = {
  entity: FicEntity;
  date: string;
  item: { name: string; description: string; grossEuros: number; vatId: number };
  payment: { grossEuros: number; paidOn: string; accountId?: number };
  eiPaymentMethod: string;
  subject: string;
};
export type FicDocument = { id: number; number?: number | string; numeration?: string; date?: string; url?: string };
export async function ficCreateInvoice(input: FicInvoiceInput): Promise<FicDocument> {
  const body = {
    data: {
      type: "invoice",
      entity: input.entity,
      date: input.date,
      subject: input.subject,
      visible_subject: input.subject,
      language: { code: "it", name: "Italiano" },
      currency: { id: "EUR" },
      // Prezzi lordi: il totale della fattura deve coincidere al centesimo con
      // l'importo addebitato da Stripe, non con un netto ricalcolato.
      use_gross_prices: true,
      items_list: [
        { name: input.item.name, description: input.item.description, qty: 1, gross_price: input.item.grossEuros, vat: { id: input.item.vatId } },
      ],
      payments_list: [
        {
          amount: input.payment.grossEuros,
          due_date: input.payment.paidOn,
          paid_date: input.payment.paidOn,
          status: "paid",
          ...(input.payment.accountId ? { payment_account: { id: input.payment.accountId } } : {}),
        },
      ],
      e_invoice: true,
      ei_data: { vat_kind: "I", payment_method: input.eiPaymentMethod },
    },
  };
  const result = await call<{ data: FicDocument }>("/issued_documents", { method: "POST", body: JSON.stringify(body) });
  return result.data;
}
export async function ficSendInvoice(documentId: number): Promise<void> {
  await call(`/issued_documents/${documentId}/e_invoice/send`, { method: "POST", body: JSON.stringify({ data: {} }) });
}
export async function ficInvoicePdf(documentId: number): Promise<Response> {
  const result = await call<{ data: FicDocument }>(`/issued_documents/${documentId}?fields=id,number,url`);
  if (!result.data.url) throw new PlatformError(409, "FIC_PDF_UNAVAILABLE", "Il PDF non è ancora disponibile.");
  const pdf = await fetch(result.data.url, { cache: "no-store" });
  if (!pdf.ok) throw new PlatformError(502, "FIC_PDF_ERROR", "Il PDF non è raggiungibile.");
  return pdf;
}
