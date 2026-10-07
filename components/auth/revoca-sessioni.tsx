"use client";

import { useTransition } from "react";
import { Bottone } from "@/components/ui/bottone";
import { revocaTutteLeSessioni } from "@/app/area/azioni";

export function BottoneRevocaSessioni() {
  const [inCorso, avvia] = useTransition();
  return (
    <Bottone
      variante="distruttivo"
      misura="piccola"
      disabled={inCorso}
      onClick={() => avvia(async () => void (await revocaTutteLeSessioni()))}
    >
      {inCorso ? "Revoca…" : "Esci da tutti i dispositivi"}
    </Bottone>
  );
}
