import type { Metadata } from "next";
import { Titolo } from "@/components/ui/primitivi";
import { Tabella, Riga, Cella } from "@/components/ui/tabella";
import { Badge } from "@/components/ui/badge";
import { ModuloInvitoStaff } from "@/components/staff/invita";
import { staffPerPagina } from "@/lib/auth/sessione";
import { haPermesso } from "@/lib/auth/attore";
import { elencaStaff } from "@/lib/dati/utenti";
import { ETICHETTE_RUOLO } from "@/lib/auth/ruoli";
import { dataEstesa } from "@/lib/format";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const INTESTAZIONI = [
  { chiave: "persona", testo: "Persona" },
  { chiave: "ruolo", testo: "Ruolo" },
  { chiave: "stato", testo: "Stato" },
  { chiave: "ultimo", testo: "Ultimo accesso" },
  { chiave: "dal", testo: "Account dal" },
] as const;

export default async function PaginaStaff() {
  const attore = await staffPerPagina("/admin/staff", "staff.vedi");
  const staff = await elencaStaff(attore);
  const puoInvitare = haPermesso(attore, "staff.invita");

  return (
    <div className="flex flex-col gap-8">
      <Titolo
        livello={1}
        occhiello={`${staff.length} account staff`}
        sotto="Account nominativi: niente credenziali condivise. I permessi dipendono dal ruolo."
      >
        Staff
      </Titolo>

      {puoInvitare ? (
        <section aria-labelledby="invita-staff" className="grid gap-3">
          <h2 id="invita-staff" className="text-lg font-medium text-testo">
            Invita una persona
          </h2>
          <p className="max-w-2xl text-sm text-testo-tenue">
            Riceverà un link monouso per creare l&rsquo;account. Il link scade dopo sette giorni.
          </p>
          <ModuloInvitoStaff />
        </section>
      ) : null}

      <Tabella intestazioni={INTESTAZIONI} didascalia="Account dello staff">
        {staff.map((u) => (
          <Riga key={u.id}>
            <Cella intestazione>
              <span className="block text-testo">{u.nome ?? "Nome non impostato"}</span>
              <span className="block text-xs text-testo-tenue">{u.email}</span>
            </Cella>
            <Cella>
              <Badge tono={u.ruolo === "super_admin" ? "viola" : "neutro"}>
                {ETICHETTE_RUOLO[u.ruolo]}
              </Badge>
            </Cella>
            <Cella>
              <Badge tono={u.attivo ? "successo" : "errore"}>{u.attivo ? "Attivo" : "Disattivato"}</Badge>
            </Cella>
            <Cella>{u.ultimoAccessoAt ? dataEstesa(u.ultimoAccessoAt) : "Mai"}</Cella>
            <Cella>{u.createdAt ? dataEstesa(u.createdAt) : "—"}</Cella>
          </Riga>
        ))}
      </Tabella>
    </div>
  );
}
