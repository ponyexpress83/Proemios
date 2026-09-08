import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Gabbia, Occhiello } from "@/components/ui/primitivi";
import { Bottone } from "@/components/ui/bottone";
import { accettaInvito } from "@/lib/dati/utenti";

export const metadata: Metadata = { title: "Accetta invito", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PaginaInvito({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  async function accetta(formData: FormData) {
    "use server";
    const nomeRaw = formData.get("nome");
    const nome = typeof nomeRaw === "string" && nomeRaw.trim() ? nomeRaw.trim().slice(0, 200) : null;
    try {
      const account = await accettaInvito(token, nome);
      redirect(`/accedi?da=${encodeURIComponent(account.ruolo === "client" ? "/area" : "/admin")}`);
    } catch {
      redirect("/accedi?errore=invito");
    }
  }

  return (
    <Gabbia className="flex min-h-[70dvh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-xl border border-bordo bg-superficie p-6 sm:p-8">
        <Occhiello>Invito personale</Occhiello>
        <h1 className="mt-3 text-3xl font-semibold text-testo">Attiva il tuo account</h1>
        <p className="mt-3 text-sm leading-relaxed text-testo-attenuato">
          Inserisci il nome che vuoi mostrare ai colleghi. Dopo l&rsquo;attivazione riceverai i link di accesso sulla tua email: non ci sono password condivise.
        </p>
        <form action={accetta} className="mt-7 grid gap-4">
          <label className="grid gap-2 text-sm text-testo-attenuato">
            Nome e cognome
            <input
              name="nome"
              required
              maxLength={200}
              autoComplete="name"
              className="h-10 rounded-md border border-bordo-forte bg-fondo px-3 text-testo outline-none focus:border-viola"
            />
          </label>
          <Bottone type="submit" variante="identita" misura="grande">
            Attiva account
          </Bottone>
        </form>
      </div>
    </Gabbia>
  );
}
