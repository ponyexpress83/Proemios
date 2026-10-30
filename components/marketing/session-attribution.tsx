"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureSessionAttribution } from "@/lib/attribution-client";
/** Legge i parametri di campagna a ogni navigazione e li tiene nella sessione: nessun cookie. */
export function SessionAttribution() {
  const pathname = usePathname();
  useEffect(() => { captureSessionAttribution(); }, [pathname]);
  return null;
}
