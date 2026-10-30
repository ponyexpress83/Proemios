"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { DEMO_SESSION_KEY, validDemoSession } from "@/lib/author-demo";
import { Book } from "@/components/editorial/book";
import Link from "@/components/editorial/link";
import { authorSection } from "./navigation";
export function DemoLogin() {
  const [error, setError] = useState("");
  function login() {
    try {
      sessionStorage.setItem(
        DEMO_SESSION_KEY,
        JSON.stringify({ user: "demo-author", createdAt: Date.now() }),
      );
      if (!validDemoSession(sessionStorage.getItem(DEMO_SESSION_KEY))) {
        throw new Error("Sessione demo non conservata dal browser");
      }
      const section = authorSection(new URLSearchParams(window.location.search).get("sezione"));
      window.location.assign("/area-autore?sezione=" + section);
    } catch {
      setError("Consenti l’archiviazione per questa scheda del browser per aprire la demo.");
    }
  }
  return (
    <section className="demo-login container">
      <div className="demo-login-story">
        <p className="eyebrow">IL TUO SPAZIO PROEMIOS</p>
        <h1>
          Il tuo libro.
          <br />
          <em>Il tuo prossimo capitolo.</em>
        </h1>
        <p>
          Stato del progetto, messaggi, file e approvazioni. Entra e prova il percorso dal punto di
          vista dell’autore.
        </p>
        <div className="login-book">
          <Book small />
        </div>
        <span className="demo-label">DEMO INTERATTIVA · DATI DI ESEMPIO</span>
      </div>
      <div className="login-card">
        <h2>Benvenuto nel tuo spazio.</h2>
        <p>Un ingresso dedicato agli autori, con la stessa cura del tuo libro.</p>
        <div className="demo-entry-details">
          <strong>Esplora il progetto di esempio</strong>
          <p>
            Non occorrono email o password. Questa è una simulazione pubblica, non l’accesso a un
            account cliente.
          </p>
          {error && (
            <p className="assistant-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" type="button" onClick={login}>
            Entra con un clic → <ArrowRight size={18} />
          </button>
        </div>
        <p className="assistant-note">
          La demo salva le modifiche solo in questa scheda, senza inviare messaggi o pagamenti. Non
          inserire dati personali. L’accesso agli account reali non è ancora attivo.
        </p>
        <Link className="text-link" href="/admin">
          Accesso riservato al team →
        </Link>
      </div>
    </section>
  );
}
