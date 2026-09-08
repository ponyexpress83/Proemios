import type { Metadata } from "next";
import { Titolo } from "@/components/ui/primitivi";
import { Tabella, Riga, Cella } from "@/components/ui/tabella";
import { Badge } from "@/components/ui/badge";
import { StatoVuoto } from "@/components/ui/stati";
import { staffPerPagina } from "@/lib/auth/sessione";
import { elencaAudit } from "@/lib/dati/audit";
import { dataEstesa } from "@/lib/format";

export const metadata: Metadata = { title: "Audit", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const INTESTAZIONI = [
  { chiave: "quando", testo: "Quando" },
  { chiave: "azione", testo: "Azione" },
  { chiave: "attore", testo: "Attore" },
  { chiave: "entita", testo: "Entità" },
  { chiave: "esito", testo: "Esito" },
] as const;

export default async function PaginaAudit() {
  const attore = await staffPerPagina("/admin/audit", "audit.vedi");
  const eventi = await elencaAudit(attore, 150);

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello="Sicurezza e tracciabilità"
        sotto="Registro append-only delle operazioni rilevanti. Non contiene manoscritti, prompt o segreti."
      >
        Audit
      </Titolo>
      {eventi.length === 0 ? (
        <StatoVuoto titolo="Nessun evento" descrizione="Gli eventi compariranno qui mentre il team usa la piattaforma." />
      ) : (
        <Tabella intestazioni={INTESTAZIONI} didascalia="Ultimi eventi di audit">
          {eventi.map((e) => (
            <Riga key={e.id}>
              <Cella><span className="cifre text-xs">{dataEstesa(e.createdAt)}</span></Cella>
              <Cella intestazione><span className="text-sm text-testo">{e.azione}</span></Cella>
              <Cella><span className="text-xs text-testo-attenuato">{e.attoreRuolo ?? "sistema"}</span></Cella>
              <Cella>
                <span className="text-xs text-testo-attenuato">
                  {e.entita ?? "—"}{e.entitaId ? ` · ${e.entitaId.slice(0, 8)}…` : ""}
                </span>
              </Cella>
              <Cella>
                <Badge tono={e.esito === "ok" ? "successo" : e.esito === "negato" ? "attenzione" : "errore"}>
                  {e.esito}
                </Badge>
              </Cella>
            </Riga>
          ))}
        </Tabella>
      )}
    </div>
  );
}
