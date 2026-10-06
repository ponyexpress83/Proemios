"use client";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_SESSION_KEY } from "@/lib/author-demo";
import { Book } from "@/components/editorial/book";
import Link from "@/components/editorial/link";
export function DemoLogin() {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  function login(direct = false) {
    if (!direct && (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD)) {
      setError("Questa è l’area demo: usa le credenziali di esempio indicate sotto.");
      return;
    }
    try {
      sessionStorage.setItem(
        DEMO_SESSION_KEY,
        JSON.stringify({ user: "demo-author", createdAt: Date.now() }),
      );
      window.location.assign("/area-autore");
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login();
          }}
        >
          <label htmlFor="demo-email">Email demo</label>
          <input
            id="demo-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="demo-password">Password demo</label>
          <div className="password-field">
            <input
              id="demo-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={show ? "Nascondi password" : "Mostra password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {error && (
            <p className="assistant-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" type="submit">
            Accedi alla demo <ArrowRight size={18} />
          </button>
        </form>
        <div className="demo-credentials">
          <strong>Credenziali pubbliche di esempio</strong>
          <span>{DEMO_EMAIL}</span>
          <code>{DEMO_PASSWORD}</code>
          <button className="text-link" onClick={() => login(true)}>
            Entra con un clic →
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
