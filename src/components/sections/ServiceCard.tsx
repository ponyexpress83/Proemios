import Link from "next/link";
import type { Route } from "next";
import type { Service } from "@/config/services";
import { euro } from "@/lib/format";
import { cn } from "@/lib/cn";

export function ServiceCard({ service }: { service: Service }) {
  const prezzo = service.prezzo
    ? `${euro(service.prezzo.min)}–${euro(service.prezzo.max)}${service.prezzo.suffix ?? ""}`
    : service.prezzoLabel;

  return (
    <Link
      href={`/servizi/${service.slug}` as Route}
      className={cn(
        "group bg-carta lift hover:border-bronzo flex flex-col rounded-lg border p-6 hover:-translate-y-0.5 sm:p-7",
        service.inEvidenza ? "border-bronzo/60" : "border-linea",
      )}
    >
      {service.inEvidenza && (
        <span className="bg-bronzo/10 text-bronzo-scuro mb-3 self-start rounded-full px-2.5 py-1 text-xs font-semibold tracking-wider uppercase">
          Più richiesto
        </span>
      )}
      <h3 className="font-display text-inchiostro text-xl font-medium">{service.nome}</h3>
      <p className="text-inchiostro-60 mt-2 flex-1 text-sm leading-relaxed">{service.tagline}</p>
      <div className="border-linea mt-5 flex items-center justify-between border-t pt-4">
        <span className="text-inchiostro nums-tabular text-sm font-medium">{prezzo}</span>
        <span className="text-bronzo text-sm font-medium transition-transform group-hover:translate-x-0.5">
          Scopri →
        </span>
      </div>
    </Link>
  );
}
