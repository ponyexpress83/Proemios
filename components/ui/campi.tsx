"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Campi di form. Label reali (mai un placeholder al posto della label),
 * errore annunciato via aria-describedby + role="alert", area di tocco ≥ 44px
 * su mobile.
 */

export const campoBase =
  "garbo w-full rounded-md border border-bordo-forte bg-superficie px-4 text-sm text-testo " +
  "placeholder:text-testo-tenue/70 hover:border-bordo-forte " +
  "focus:border-viola focus:outline-none focus-visible:outline-2 focus-visible:outline-lime " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-errore";

export function Campo({
  label,
  hint,
  errore,
  obbligatorio,
  children,
  id,
  className,
}: {
  label: string;
  hint?: ReactNode;
  errore?: string;
  obbligatorio?: boolean;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  id: string;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const erroreId = errore ? `${id}-errore` : undefined;
  const describedBy = [hintId, erroreId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-testo">
        {label}
        {obbligatorio && (
          <span className="text-lime" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-testo-tenue">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": errore ? true : undefined })}
      {errore && (
        <p id={erroreId} className="text-sm text-errore" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

export function Input({
  className,
  ...resto
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(campoBase, "h-11", className)} {...resto} />;
}

export function AreaTesto({
  className,
  ...resto
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(campoBase, "min-h-28 resize-y py-3", className)} {...resto} />;
}

export function Selezione({
  className,
  children,
  ...resto
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(campoBase, "h-11 appearance-none pr-10", className)} {...resto}>
      {children}
    </select>
  );
}

/** Consenso: checkbox mai pre-spuntata, con spazio per il link alla policy. */
export function Consenso({
  id,
  name,
  checked,
  onChange,
  children,
  className,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded-[3px] border border-bordo-forte accent-viola"
      />
      <span className="text-sm leading-relaxed text-testo-attenuato">{children}</span>
    </label>
  );
}

/**
 * Gruppo di scelte come schede cliccabili: usato dal configuratore di
 * preventivo e dall'onboarding. Radio veri sotto, così la navigazione da
 * tastiera con le frecce funziona senza JavaScript aggiuntivo.
 */
export function ScelteScheda<T extends string>({
  name,
  valore,
  onChange,
  opzioni,
  colonne = 2,
  className,
}: {
  name: string;
  valore: T | null;
  onChange: (v: T) => void;
  opzioni: ReadonlyArray<{ valore: T; titolo: string; descrizione?: string }>;
  colonne?: 1 | 2 | 3;
  className?: string;
}) {
  const griglie = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" } as const;
  return (
    <div className={cn("grid grid-cols-1 gap-3", griglie[colonne], className)} role="radiogroup">
      {opzioni.map((o) => {
        const attiva = valore === o.valore;
        const id = `${name}-${o.valore}`;
        return (
          <label
            key={o.valore}
            htmlFor={id}
            className={cn(
              "garbo flex cursor-pointer flex-col gap-1 rounded-md border p-4",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lime",
              attiva
                ? "border-viola bg-viola/10"
                : "border-bordo bg-superficie hover:border-bordo-forte hover:bg-superficie-viva",
            )}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={o.valore}
              checked={attiva}
              onChange={() => onChange(o.valore)}
              className="sr-only"
            />
            <span className="text-sm font-medium text-testo">{o.titolo}</span>
            {o.descrizione ? (
              <span className="text-xs leading-relaxed text-testo-tenue">{o.descrizione}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
