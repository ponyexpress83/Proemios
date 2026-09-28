import type { Metadata } from "next";
import { Titolo } from "@/components/ui/primitivi";
import { ModuloNuovoCliente } from "@/components/clienti/nuovo-cliente";
import { staffPerPagina } from "@/lib/auth/sessione";

export const metadata: Metadata = { title: "Nuovo cliente", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PaginaNuovoCliente() {
  await staffPerPagina("/admin/clienti/nuovo", "cliente.modifica");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Titolo
        livello={1}
        occhiello="Onboarding"
        sotto="Per clienti già acquisiti fuori da Proemios. Non vengono creati lead fittizi e il funnel marketing resta pulito."
      >
        Inserisci un cliente attuale
      </Titolo>
      <ModuloNuovoCliente />
    </div>
  );
}
