import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { actorFromHeaders } from "./access";
import { PlatformError } from "./http";
import { authConfigured } from "./config";
export async function pageActor() {
  if (!authConfigured()) return null;
  try {
    return await actorFromHeaders(await headers(), { allowUnenrolled: true });
  } catch (e) {
    if (e instanceof PlatformError && [401, 403].includes(e.status)) redirect("/accedi");
    throw e;
  }
}
export function PlatformUnavailable() {
  return (
    <section className="platform-auth">
      <p className="platform-eyebrow">PROEMIOS / IL TUO SPAZIO</p>
      <h1>Stiamo attivando la piattaforma.</h1>
      <p>
        L’accesso personale sarà disponibile dopo il collegamento dei servizi. Puoi già raccontarci
        il tuo progetto.
      </p>
      <Link href="/contatti" className="platform-button">
        Contattaci →
      </Link>
    </section>
  );
}
