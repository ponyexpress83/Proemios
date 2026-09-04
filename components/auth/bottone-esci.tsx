"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Bottone } from "@/components/ui/bottone";
import { esci } from "@/app/accedi/azioni";

export function BottoneEsci() {
  const [inCorso, avvia] = useTransition();
  return (
    <Bottone
      variante="secondario"
      misura="piccola"
      disabled={inCorso}
      onClick={() => avvia(async () => void (await esci()))}
    >
      <LogOut className="size-3.5" aria-hidden />
      {inCorso ? "Uscita…" : "Esci"}
    </Bottone>
  );
}
