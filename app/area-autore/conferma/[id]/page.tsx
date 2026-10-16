import { redirect } from "next/navigation";
import type { Route } from "next";
import { pageActor, PlatformUnavailable } from "@/lib/platform/page-access";
import { REALM_HOME, realmFor } from "@/lib/platform/realms";
import { PurchaseConfirm } from "@/components/author/purchase-confirm";
export const dynamic = "force-dynamic";
export const metadata = { title: "Conferma la tua proposta", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
/**
 * La pagina della proposta per l'autore: stima, valutazione, proposta
 * acquistabile, accettazione e pagamento, in un unico posto. Chi non è un
 * autore viene portato nella propria area.
 */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await pageActor();
  if (!actor) return <PlatformUnavailable />;
  const realm = realmFor(actor.roles);
  if (realm !== "author") redirect(REALM_HOME[realm] as Route);
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) redirect("/area-autore" as Route);
  return <PurchaseConfirm quoteId={id} user={{ id: actor.id, name: actor.name, email: actor.email }} initialTier={sp.pacchetto} payment={sp.pagamento} />;
}
