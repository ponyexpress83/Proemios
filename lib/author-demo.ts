/** Dati fittizi, isolati nella scheda del browser. Nessun account o archivio reale. */
export const DEMO_EMAIL = "demo@proemios.it";
export const DEMO_PASSWORD = "ProemiosDemo2026!";
export const DEMO_SESSION_KEY = "proemios-author-demo-session-v1";
export const DEMO_STATE_KEY = "proemios-author-demo-state-v1";
export type DemoMessage = { id: string; from: "author" | "editor"; text: string };
export type DemoState = { approved: boolean; messages: DemoMessage[] };
export function initialDemoState(): DemoState {
  return {
    approved: false,
    messages: [
      {
        id: "welcome",
        from: "editor",
        text: "Benvenuto nella demo. Ho preparato una revisione del primo capitolo: puoi leggerla in File e revisioni e simulare l’approvazione. Questo messaggio è un esempio.",
      },
    ],
  };
}
export function validDemoSession(value: string | null, now = Date.now()): boolean {
  if (!value) return false;
  try {
    const s = JSON.parse(value) as { user?: string; createdAt?: number };
    return (
      s.user === "demo-author" &&
      typeof s.createdAt === "number" &&
      s.createdAt <= now &&
      now - s.createdAt < 8 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}
export function restoreDemoState(value: string | null): DemoState {
  if (!value) return initialDemoState();
  try {
    const d = JSON.parse(value) as DemoState;
    if (
      typeof d.approved !== "boolean" ||
      !Array.isArray(d.messages) ||
      d.messages.length > 100 ||
      d.messages.some(
        (m) =>
          typeof m.id !== "string" ||
          typeof m.text !== "string" ||
          m.text.length > 3000 ||
          !["author", "editor"].includes(m.from),
      )
    )
      return initialDemoState();
    return d;
  } catch {
    return initialDemoState();
  }
}
export function addDemoMessage(state: DemoState, text: string, id: string): DemoState {
  const content = text.trim().slice(0, 3000);
  if (!content) return state;
  return {
    ...state,
    messages: [
      ...state.messages.slice(-96),
      { id, from: "author", text: content },
      {
        id: id + "-reply",
        from: "editor",
        text: "Risposta simulata: il messaggio compare nella conversazione del progetto. Nella piattaforma operativa sarà il team editoriale a risponderti.",
      },
    ],
  };
}
export const DEMO_ORIGINAL =
  "Quando tornò al paese, lui si accorse che tutto era cambiato, ma anche tutto era rimasto uguale. Le case erano sempre li. E la piazza era sempre quella piazza che lui conosceva così bene.";
export const DEMO_REVISED =
  "Quando tornò al paese, gli sembrò che tutto fosse diverso. Eppure riconosceva ogni angolo. Le case erano ancora lì. La piazza conservava le voci e le ombre che ricordava.";
