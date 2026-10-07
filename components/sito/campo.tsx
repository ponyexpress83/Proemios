"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Campi dei form del sito pubblico. Stessa API di `components/ui/campi.tsx`
 * (che resta per le aree riservate), con i token della carta: label sempre
 * visibile sopra, aiuto sotto la label, errore sotto il campo in rosso con
 * icona e testo, `aria-describedby` e `aria-invalid` passati al controllo.
 */

export const campoBase =
  "w-full rounded-campo border border-filetto bg-bianco px-4 text-t-base text-inchiostro " +
  "placeholder:text-grafite/70 transition-[border-color,box-shadow] duration-200 ease-matita " +
  "hover:border-grafite focus:border-blu-matita focus:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-blu-matita focus-visible:ring-offset-2 focus-visible:ring-offset-carta " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "aria-[invalid=true]:border-rosso-matita aria-[invalid=true]:border-2";

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
    required?: boolean;
  }) => ReactNode;
  id: string;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const erroreId = errore ? `${id}-errore` : undefined;
  const describedBy = [hintId, erroreId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-t-sm font-bold text-inchiostro">
        {label}
        {obbligatorio ? (
          <span className="text-grafite font-normal"> (obbligatorio)</span>
        ) : (
          <span className="text-grafite font-normal"> (facoltativo)</span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-t-xs text-grafite">
          {hint}
        </p>
      )}
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": errore ? true : undefined,
        required: obbligatorio,
      })}
      {errore && (
        <p id={erroreId} className="flex items-start gap-1.5 text-t-sm text-rosso-matita">
          <IconaErrore />
          <span>{errore}</span>
        </p>
      )}
    </div>
  );
}

function IconaErrore() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5v4M8 11v.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function Input({ className, ...resto }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(campoBase, "h-12", className)} {...resto} />;
}

export function AreaTesto({
  className,
  ...resto
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea className={cn(campoBase, "min-h-32 resize-y py-3", className)} {...resto} />;
}

export function Selezione({
  className,
  children,
  ...resto
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(campoBase, "h-12 appearance-none pr-10", className)} {...resto}>
      {children}
    </select>
  );
}

/** Consenso: casella mai pre-spuntata, area di tocco ≥ 44 px. */
export function Consenso({
  id,
  name,
  checked,
  onChange,
  children,
  className,
  errore,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  className?: string;
  errore?: string;
}) {
  const erroreId = errore ? `${id}-errore` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={erroreId}
          aria-invalid={errore ? true : undefined}
          className="mt-1 size-5 shrink-0 rounded-campo border border-grafite accent-blu-matita"
        />
        <span className="text-t-sm text-grafite">{children}</span>
      </label>
      {errore && (
        <p id={erroreId} className="mt-1 flex items-start gap-1.5 text-t-sm text-rosso-matita">
          <IconaErrore />
          <span>{errore}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Riepilogo degli errori, focalizzato all'invio: dice cosa manca e porta al
 * campo con un click. Va reso solo quando ci sono errori.
 */
export function RiepilogoErrori({
  errori,
  className,
}: {
  errori: { id: string; messaggio: string }[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [errori]);
  if (errori.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className={cn(
        "rounded-campo border-2 border-rosso-matita bg-bianco p-4 text-t-sm text-inchiostro",
        className,
      )}
    >
      <p className="font-bold">
        {errori.length === 1 ? "C'è un campo da sistemare." : `Ci sono ${errori.length} campi da sistemare.`}
      </p>
      <ul className="mt-2 list-disc pl-5">
        {errori.map((e) => (
          <li key={e.id}>
            <a href={`#${e.id}`} className="sottolinea-matita text-blu-matita">
              {e.messaggio}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
