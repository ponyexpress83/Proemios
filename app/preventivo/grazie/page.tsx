import { eq } from "drizzle-orm";
import { demoAttiva } from "@/lib/demo";
import { stripe, stripeConfigurato } from "@/lib/stripe";
import { metadatiPagina } from "@/lib/seo";
import Link from "@/components/editorial/link";
import { getDb } from "@/db";
import { paymentOrders } from "@/db/platform-schema";
import { pageActor } from "@/lib/platform/page-access";
import { PurchaseEvent } from "@/components/marketing/analytics";
export const dynamic = "force-dynamic";
export const metadata = metadatiPagina({
  titolo: "Esito del pagamento",
  descrizione: "Esito del pagamento del percorso editoriale Proemios.",
  path: "/preventivo/grazie",
  noindex: true,
});
type Outcome = "simulated" | "paid" | "pending" | "unknown";
const formatCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
/**
 * Ritorno da Stripe. Lo stato vero lo scrive il webhook: qui si legge soltanto
 * l'ordine della persona che ha pagato (sessione richiesta, ordine suo) e si
 * mostra se Stripe lo ha già confermato o se la conferma è in arrivo.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; session_id?: string }>;
}) {
  const sp = await searchParams;
  if (demoAttiva() && sp.demo === "1") return <Esito outcome="simulated" />;
  const actor = await pageActor();
  if (!actor) return <Esito outcome="unknown" />;
  let outcome: Outcome = "unknown", quoteId: string | null = null, kind = "deposit", amountCents: number | null = null, paidOrderId: string | null = null;
  if (!demoAttiva() && stripeConfigurato() && sp.session_id && /^cs_[a-zA-Z0-9_]{10,240}$/.test(sp.session_id)) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sp.session_id);
      const orderId = session.metadata?.orderId;
      if (orderId && /^[0-9a-f-]{36}$/.test(orderId)) {
        const [order] = await getDb().select().from(paymentOrders).where(eq(paymentOrders.id, orderId));
        if (order && order.authorId === actor.id && order.stripeSessionId === session.id) {
          quoteId = order.quoteId; kind = order.kind; amountCents = order.amountCents; paidOrderId = order.id;
          outcome = order.status === "paid" ? "paid" : session.payment_status === "paid" ? "pending" : "unknown";
        }
      }
    } catch {
      outcome = "unknown";
    }
  }
  return <>{outcome === "paid" && paidOrderId && amountCents !== null ? <PurchaseEvent orderId={paidOrderId} valueCents={amountCents} kind={kind} /> : null}<Esito outcome={outcome} quoteId={quoteId} kind={kind} amountCents={amountCents} /></>;
}
function Esito({ outcome, quoteId, kind, amountCents }: { outcome: Outcome; quoteId?: string | null; kind?: string; amountCents?: number | null }) {
  const area = quoteId ? `/area-autore?preventivo=${encodeURIComponent(quoteId)}&vista=pagamenti` : "/area-autore?vista=pagamenti";
  const label = kind === "balance" ? "saldo" : "acconto";
  const eyebrow = { simulated: "SIMULAZIONE COMPLETATA", paid: "PAGAMENTO CONFERMATO", pending: "PAGAMENTO IN CONFERMA", unknown: "CONFERMA NON DISPONIBILE" }[outcome];
  return (
    <section className="operative">
      <div className="container">
        <div className="form-card" style={{ maxWidth: 760, margin: "auto" }}>
          <p className="eyebrow">{eyebrow}</p>
          <h1 style={{ fontSize: "clamp(2.8rem,5vw,4rem)" }}>
            {outcome === "simulated" ? (<>Hai provato<br /><em>il prossimo passo.</em></>)
              : outcome === "paid" ? (<>Un nuovo<br /><em>capitolo comincia.</em></>)
              : outcome === "pending" ? (<>Stiamo registrando<br /><em>il tuo pagamento.</em></>)
              : (<>Verifichiamo<br /><em>il tuo percorso.</em></>)}
          </h1>
          <p style={{ marginTop: 25 }}>
            {outcome === "simulated"
              ? "Nessun pagamento è stato aperto, nessun importo addebitato e nessuna email inviata. La data di lavorazione non è stata prenotata."
              : outcome === "paid"
                ? `Il pagamento dell'${label}${amountCents ? ` di ${formatCents(amountCents)}` : ""} è stato confermato. Riceverai la ricevuta via email; nella tua area trovi il progetto e i prossimi passi.`
                : outcome === "pending"
                  ? `Stripe ha accettato il pagamento dell'${label}${amountCents ? ` di ${formatCents(amountCents)}` : ""}. La conferma definitiva arriva entro pochi minuti: la trovi nella tua area, insieme alla ricevuta via email.`
                  : "Da questo collegamento non possiamo confermare un pagamento. Se hai già completato il checkout, apri la tua area o contatta il team conservando la ricevuta."}
          </p>
          <div className="dialog-actions">
            <Link href={outcome === "simulated" ? "/accedi" : outcome === "unknown" ? "/contatti" : area} className="button">
              {outcome === "simulated" ? "Prova l’area autore" : outcome === "unknown" ? "Parla con noi" : "Apri la tua area"} →
            </Link>
            <Link href={outcome === "unknown" ? "/area-autore" : "/"} className="button secondary">
              {outcome === "unknown" ? "La tua area" : "Torna alla home"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
