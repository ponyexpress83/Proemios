"use client";
import { useEffect, useState, type FormEvent } from "react";
import { platformApi } from "@/components/platform/workspace";
export type Billing = { kind: "private" | "business"; name: string; taxCode: string | null; vatNumber: string | null; street: string; postcode: string; city: string; province: string | null; country: string; sdiCode: string | null; pec: string | null };
export const emptyBilling = (name: string): Billing => ({ kind: "private", name, taxCode: "", vatNumber: "", street: "", postcode: "", city: "", province: "", country: "IT", sdiCode: "", pec: "" });
export const billingPayload = (form: Billing) => ({ ...form, taxCode: form.taxCode || "", vatNumber: form.vatNumber || "", province: form.province || "", sdiCode: form.sdiCode || "", pec: form.pec || "" });
export const billingSummary = (b: Billing) => `${b.name} · ${b.kind === "business" ? `P. IVA ${b.vatNumber}` : `CF ${b.taxCode}`} · ${b.street}, ${b.postcode} ${b.city}${b.province ? ` (${b.province})` : ""}`;
/** I campi di fatturazione, riusati nella sezione Pagamenti e nella pagina di conferma. */
export function BillingFields({ form, onChange }: { form: Billing; onChange: (next: Billing) => void }) {
  const set = (key: keyof Billing) => (e: { target: { value: string } }) => onChange({ ...form, [key]: e.target.value });
  const business = form.kind === "business";
  return (
    <>
      <label>Intestazione<select value={form.kind} onChange={(e) => onChange({ ...form, kind: e.target.value as Billing["kind"] })}><option value="private">Persona fisica</option><option value="business">Azienda o professionista con partita IVA</option></select></label>
      <label>{business ? "Ragione sociale" : "Nome e cognome"}<input required minLength={2} maxLength={200} value={form.name} onChange={set("name")} autoComplete="name" /></label>
      {business ? (
        <>
          <label>Partita IVA<input required pattern="[0-9]{11}" value={form.vatNumber ?? ""} onChange={set("vatNumber")} inputMode="numeric" /></label>
          <label>Codice fiscale (se diverso dalla partita IVA)<input value={form.taxCode ?? ""} onChange={set("taxCode")} /></label>
          <label>Codice destinatario SdI<input maxLength={7} value={form.sdiCode ?? ""} onChange={set("sdiCode")} placeholder="7 caratteri, oppure indica la PEC" /></label>
          <label>PEC<input type="email" value={form.pec ?? ""} onChange={set("pec")} /></label>
        </>
      ) : (
        <label>Codice fiscale<input required={form.country === "IT"} maxLength={16} value={form.taxCode ?? ""} onChange={set("taxCode")} style={{ textTransform: "uppercase" }} autoComplete="off" /></label>
      )}
      <label>Indirizzo<input required minLength={3} maxLength={200} value={form.street} onChange={set("street")} autoComplete="street-address" /></label>
      <div className="author-billing-row">
        <label>CAP<input required value={form.postcode} onChange={set("postcode")} autoComplete="postal-code" inputMode="numeric" /></label>
        <label>Città<input required value={form.city} onChange={set("city")} autoComplete="address-level2" /></label>
        <label>Provincia<input maxLength={2} value={form.province ?? ""} onChange={set("province")} placeholder="es. MI" style={{ textTransform: "uppercase" }} /></label>
        <label>Paese<input required maxLength={2} value={form.country} onChange={set("country")} style={{ textTransform: "uppercase" }} autoComplete="country" /></label>
      </div>
    </>
  );
}
/** Dati di fatturazione: chiesti una volta, prima del primo pagamento, e modificabili. */
export function BillingSection({ user, onReady }: { user: { name: string }; onReady: () => void }) {
  const [billing, setBilling] = useState<Billing | null | undefined>(undefined), [editing, setEditing] = useState(false), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Billing>(emptyBilling(user.name));
  useEffect(() => { let live = true; platformApi<{ billing: Billing | null }>("me/billing").then(v => { if (!live) return; setBilling(v.billing); if (v.billing) setForm({ ...v.billing, taxCode: v.billing.taxCode ?? "", vatNumber: v.billing.vatNumber ?? "", province: v.billing.province ?? "", sdiCode: v.billing.sdiCode ?? "", pec: v.billing.pec ?? "" }); }).catch(e => live && setError(e.message)); return () => { live = false; }; }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const saved = await platformApi<{ billing: Billing }>("me/billing", "PUT", billingPayload(form));
      setBilling(saved.billing); setEditing(false); onReady();
    } catch (e) { setError(e instanceof Error ? e.message : "Salvataggio non riuscito."); } finally { setBusy(false); }
  }
  if (billing === undefined) return <p>Caricamento dei dati di fatturazione…</p>;
  if (billing && !editing) return <section className="author-billing"><h3>Dati di fatturazione</h3><p>{billingSummary(billing)}</p><button className="author-text-link" onClick={() => setEditing(true)}>Modifica →</button></section>;
  return <form className="author-billing author-upload" onSubmit={save}>
    <h3>Dati di fatturazione</h3>
    {!billing && <p>Servono per emettere la fattura di ogni pagamento. Li chiediamo una volta sola.</p>}
    {error && <p role="alert" className="platform-error">{error}</p>}
    <BillingFields form={form} onChange={setForm} />
    <div className="author-approval"><button type="submit" className="author-cta" disabled={busy}>Salva i dati</button>{billing && <button type="button" className="author-text-link" onClick={() => setEditing(false)}>Annulla</button>}</div>
  </form>;
}
