"use client";

import type { ReactNode } from "react";
import { cx } from "./primitivi";

/**
 * Campi di form. Label reali (mai placeholder al posto della label),
 * errore annunciato con aria-describedby, tocco ampio su mobile.
 */

const campoBase =
  "garbo w-full rounded-campo border bg-carta-alta px-4 py-3 font-ui text-inchiostro " +
  "placeholder:text-stampa/70 focus:border-alloro";

const campoNotte =
  "garbo w-full rounded-campo border border-filetto-notte bg-notte px-4 py-3 font-ui text-carta " +
  "placeholder:text-carta/40 focus:border-ottone";

export function Campo({
  label,
  hint,
  errore,
  obbligatorio,
  children,
  id,
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
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const erroreId = errore ? `${id}-errore` : undefined;
  const describedBy = [hintId, erroreId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="font-ui text-inchiostro mb-1.5 block text-sm font-medium">
        {label}
        {obbligatorio && (
          <span className="text-ottone" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="text-stampa mb-1.5 text-sm">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": errore ? true : undefined })}
      {errore && (
        <p id={erroreId} className="text-esito-critico mt-1.5 text-sm" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}

export function Input({
  tono = "carta",
  className,
  ...resto
}: { tono?: "carta" | "notte" } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(tono === "notte" ? campoNotte : campoBase, className)} {...resto} />;
}

export function AreaTesto({
  tono = "carta",
  className,
  ...resto
}: { tono?: "carta" | "notte" } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(tono === "notte" ? campoNotte : campoBase, "resize-y", className)}
      {...resto}
    />
  );
}

/** Consenso privacy: checkbox mai pre-spuntata, con link alla policy. */
export function Consenso({
  id,
  name,
  checked,
  onChange,
  children,
  tono = "carta",
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  tono?: "carta" | "notte";
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cx(
          "accent-alloro mt-0.5 size-4 shrink-0 rounded-[2px] border",
          tono === "notte" ? "border-filetto-notte" : "border-filetto-forte",
        )}
      />
      <span
        className={cx(
          "text-sm leading-relaxed",
          tono === "notte" ? "text-carta/75" : "text-stampa",
        )}
      >
        {children}
      </span>
    </label>
  );
}
