import { demoAttiva } from "@/lib/demo";
import { stripe, stripeConfigurato } from "@/lib/stripe";
import { metadatiPagina } from "@/lib/seo";
import Link from "@/components/editorial/link";
export const metadata = metadatiPagina({
  titolo: "Esito del percorso",
  descrizione: "Verifica della conferma del percorso editoriale Proemios.",
  path: "/preventivo/grazie",
  noindex: true,
});
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; session_id?: string }>;
}) {
  const sp = await searchParams;
  const simulated = demoAttiva() && sp.demo === "1";
  let paid = false;
  if (
    !demoAttiva() &&
    stripeConfigurato() &&
    sp.session_id &&
    /^cs_[a-zA-Z0-9_]{10,240}$/.test(sp.session_id)
  ) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sp.session_id);
      paid =
        session.mode === "payment" &&
        session.payment_status === "paid" &&
        Boolean(session.metadata?.quoteId);
    } catch {
      paid = false;
    }
  }
  return (
    <section className="operative">
      <div className="container">
        <div className="form-card" style={{ maxWidth: 760, margin: "auto" }}>
          <p className="eyebrow">
            {simulated
              ? "SIMULAZIONE COMPLETATA"
              : paid
                ? "PAGAMENTO VERIFICATO"
                : "CONFERMA NON DISPONIBILE"}
          </p>
          <h1 style={{ fontSize: "clamp(2.8rem,5vw,4rem)" }}>
            {simulated ? (
              <>
                Hai provato
                <br />
                <em>il prossimo passo.</em>
              </>
            ) : paid ? (
              <>
                Un nuovo
                <br />
                <em>capitolo comincia.</em>
              </>
            ) : (
              <>
                Verifichiamo
                <br />
                <em>il tuo percorso.</em>
              </>
            )}
          </h1>
          <p style={{ marginTop: 25 }}>
            {simulated
              ? "Nessun pagamento è stato aperto, nessun importo addebitato e nessuna email inviata. La data di lavorazione non è stata prenotata."
              : paid
                ? "Il pagamento risulta completato nel circuito di pagamento. Il team confermerà con te materiali, tempi e prossimi passaggi."
                : "Da questo collegamento non possiamo confermare un pagamento. Se hai già completato il checkout, conserva la ricevuta e contatta il team."}
          </p>
          <div className="dialog-actions">
            <Link href={simulated ? "/accedi" : "/contatti"} className="button">
              {simulated ? "Prova l’area autore" : "Parla con noi"} →
            </Link>
            <Link href="/" className="button secondary">
              Torna alla home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
