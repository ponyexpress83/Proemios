/**
 * Punto d'ingresso del design system. I componenti client restano importabili
 * direttamente dal loro file: questo indice esporta solo ciò che è sicuro
 * importare anche da un Server Component.
 */
export { cn, Gabbia, Sezione, Occhiello, Titolo, Filetto, Etichetta, Nota, Dato } from "./primitivi";
export { Bottone, BottoneLink, BottoneIcona } from "./bottone";
export type { VarianteBottone, MisuraBottone } from "./bottone";
export { Scheda, SchedaTestata, SchedaCorpo, SchedaPiede, SchedaMetrica } from "./scheda";
export { Badge, BadgeStato } from "./badge";
export type { TonoBadge } from "./badge";
export { Tabella, Riga, Cella } from "./tabella";
export { Progresso, AnelloProgresso } from "./progresso";
export { Cronologia, Tappa } from "./cronologia";
export type { StatoTappa } from "./cronologia";
export { StatoVuoto, Scheletro, ScheletroTesto, Avviso } from "./stati";
export type { TonoAvviso } from "./stati";
