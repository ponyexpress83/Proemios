"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Comparsa allo scorrimento. Una sola animazione in tutto il sito, con lo
 * stesso ritardo e la stessa distanza: le micro-animazioni servono a dare
 * ritmo alla lettura, non a farsi notare.
 *
 * Con `prefers-reduced-motion` il contenuto è semplicemente lì, senza opacità
 * iniziale — mai contenuto invisibile in attesa di un'animazione soppressa.
 */
export function Apparizione({
  children,
  ritardo = 0,
  className,
}: {
  children: ReactNode;
  ritardo?: number;
  className?: string;
}) {
  const motoRidotto = useReducedMotion();
  // `h-full` sempre: dentro una griglia questo div è la cella, e senza altezza
  // piena le schede della stessa riga risultano di altezze diverse.
  const classi = ["h-full", className].filter(Boolean).join(" ");

  if (motoRidotto) return <div className={classi}>{children}</div>;

  return (
    <motion.div
      className={classi}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: ritardo, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
