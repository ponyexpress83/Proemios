export const editorialStages = [
  {
    label: "Manoscritto",
    title: "Una voce da ascoltare.",
    detail: "Pagine, appunti e idee: il punto da cui parte il tuo libro.",
  },
  {
    label: "Editing",
    title: "La storia trova il ritmo.",
    detail: "Struttura e stile prendono forma nel confronto con l’editor.",
  },
  {
    label: "Revisione",
    title: "Rileggi. Confronti. Approvi.",
    detail: "Le modifiche restano visibili: scegli tu la versione da confermare.",
  },
  {
    label: "Copertina",
    title: "Una storia, un’identità.",
    detail: "Proposte grafiche diverse, una direzione da scegliere insieme.",
  },
  {
    label: "Impaginazione",
    title: "Le parole diventano pagine.",
    detail: "Una gabbia, il carattere giusto, spazio per leggere.",
  },
  {
    label: "Pubblicazione",
    title: "Il prossimo capitolo.",
    detail: "Volume e file finali, pronti per il canale concordato.",
  },
] as const;
export type JourneyState = { phase: number; mode: "playing" | "paused" | "finished" };
export type JourneyAction =
  { type: "tick" | "toggle" | "replay" } | { type: "select"; phase: number };
export const initialJourney: JourneyState = { phase: 0, mode: "playing" };
export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  if (action.type === "select")
    return { phase: Math.max(0, Math.min(5, action.phase)), mode: "paused" };
  if (action.type === "replay") return initialJourney;
  if (action.type === "toggle")
    return { ...state, mode: state.mode === "playing" ? "paused" : "playing" };
  if (state.mode !== "playing") return state;
  return state.phase === 5 ? { ...state, mode: "finished" } : { ...state, phase: state.phase + 1 };
}

/** Paper compositions split over sixteen decorative backgrounds; no duplicated interface. */
export function editorialScene(phase: number): string {
  const lines = (x: number, y: number, w = 142, count = 9) =>
    Array.from(
      { length: count },
      (_, i) => `<path d="M${x} ${y + i * 12}h${i % 4 === 3 ? w * 0.65 : w}"/>`,
    ).join("");
  const paper = (x: number, y: number, w: number, h: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#fffdf7" stroke="#c7bbb0"/>`;
  const compositions = [
    `<g transform="rotate(-9 160 150)">${paper(64, 32, 180, 235)}</g><g transform="rotate(5 160 150)">${paper(74, 28, 180, 235)}<text x="96" y="64">CAPITOLO UNO</text><g stroke="#b4a89e" stroke-width="2">${lines(96, 88, 133, 12)}</g><text x="215" y="248">01</text></g><path d="M259 145l-13 86 10 2 13-86z" fill="#d55746"/>`,
    `${paper(58, 26, 193, 242)}<text x="79" y="59">UNA NUOVA LETTURA</text><g stroke="#b4a89e" stroke-width="2">${lines(79, 84, 150, 13)}</g><g stroke="#bc483c" stroke-width="2" fill="none"><path d="M82 121h105M143 181h75M65 165q-32-12-30-42M35 123l-4 12m4-12 11 8"/><ellipse cx="147" cy="95" rx="70" ry="10"/><path d="M204 202l14 9 20-27"/></g><text x="15" y="106" fill="#bc483c">ritmo</text><rect x="169" y="230" width="107" height="45" rx="2" fill="#ffe0a1"/><text x="180" y="254">LA TUA VOCE</text>`,
    `${paper(60, 26, 193, 242)}<text x="81" y="60">VERSIONE 02</text><g stroke="#b4a89e" stroke-width="2">${lines(81, 86, 148, 11)}</g><rect x="80" y="95" width="148" height="22" fill="#c9ddce" opacity=".7"/><rect x="80" y="167" width="122" height="22" fill="#c9ddce" opacity=".7"/><g transform="rotate(-8 173 243)"><rect x="104" y="222" width="166" height="43" rx="3" fill="#dbe6d9" stroke="#62806a"/><path d="M117 243l7 7 15-19" fill="none" stroke="#3c6248" stroke-width="3"/><text x="147" y="248" fill="#35543f">APPROVATO</text></g>`,
    `<g transform="rotate(-8 94 146)"><rect x="27" y="39" width="133" height="210" fill="#c65b47"/><text x="40" y="61" fill="#fff8ed">PROPOSTA A</text><text x="43" y="114" font-size="24" fill="#fff8ed">La forma</text><text x="43" y="143" font-size="24" fill="#fff8ed">delle storie.</text><path d="M43 180h99m-99 12h65m-65 12h85" stroke="#f3bca0"/></g><g transform="rotate(7 218 155)"><rect x="153" y="55" width="133" height="210" fill="#d9d4e6"/><text x="168" y="78">PROPOSTA B</text><circle cx="220" cy="148" r="39" fill="#394960"/><text x="168" y="219" font-size="20">La forma</text><text x="168" y="243" font-size="20">delle storie.</text></g>`,
    `${paper(17, 49, 282, 208)}<path d="M158 50v206" stroke="#c7bbb0"/><g stroke="#c48577" stroke-width="1" stroke-dasharray="4 3" fill="none"><rect x="33" y="66" width="109" height="176"/><rect x="174" y="66" width="109" height="176"/><path d="M33 93h250M33 226h250"/></g><text x="42" y="87">CAPITOLO UNO</text><g stroke="#b4a89e" stroke-width="2">${lines(42, 107, 90, 10)}${lines(184, 79, 89, 12)}</g><text x="42" y="241">16</text><text x="267" y="241">17</text><text x="85" y="29" letter-spacing="3">LA GABBIA EDITORIALE</text>`,
    `<path d="M52 61l143-22 16 11-145 23z" fill="#ece4d6"/><path d="M52 61v198l14 11V73z" fill="#9f4638"/><path d="M66 73l145-23v199L66 270z" fill="#c85d48"/><text x="83" y="105" fill="#fff5e8">PROEMIOS</text><text x="82" y="150" font-size="24" fill="#fff5e8">La forma</text><text x="82" y="177" font-size="24" fill="#fff5e8">delle storie.</text><path d="M85 207h92m-92 9h73" stroke="#efb795"/><rect x="218" y="150" width="79" height="98" rx="5" fill="#394960"/><rect x="224" y="157" width="67" height="76" fill="#f4ede2"/><text x="233" y="191">EPUB</text><text x="236" y="215">PDF</text><circle cx="258" cy="240" r="3" fill="#b7aab2"/>`,
  ];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 300"><g font-family="Georgia,serif" font-size="11" fill="#414553">${compositions[phase] ?? compositions[0]}</g></svg>`)}`;
}
