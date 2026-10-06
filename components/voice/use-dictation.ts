"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult:
    ((event: { results: ArrayLike<{ [key: number]: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

/** Audio solo su richiesta. Il testo resta modificabile prima della conferma. */
export function useDictation(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);
  const stop = useCallback(() => {
    const r = recognition.current;
    recognition.current = null;
    if (r) {
      r.onresult = null;
      r.onerror = null;
      r.onend = null;
      r.stop();
    }
    setListening(false);
  }, []);
  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      const r = recognition.current;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.stop();
      }
    };
  }, []);
  function toggle() {
    if (listening) {
      stop();
      return;
    }
    const w = window as SpeechWindow;
    const API = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!API) {
      setError("La dettatura non è disponibile in questo browser. Puoi continuare scrivendo.");
      return;
    }
    stop();
    const r = new API();
    r.lang = "it-IT";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) =>
      callback.current(
        Array.from(e.results)
          .map((result) => result[0]?.transcript || "")
          .join(" "),
      );
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Il microfono non è autorizzato. Puoi continuare scrivendo."
          : "Non ho ricevuto una dettatura. Riprova o scrivi il testo.",
      );
      setListening(false);
    };
    r.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = r;
    setError("");
    try {
      r.start();
      setListening(true);
    } catch {
      stop();
      setError("Il microfono non è disponibile. Puoi continuare scrivendo.");
    }
  }
  return { supported, listening, error, toggle, stop, clearError: () => setError("") };
}
