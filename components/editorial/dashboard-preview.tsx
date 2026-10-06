"use client";
import { useId, useState } from "react";
import { Check, FileText, ShieldCheck } from "lucide-react";
import { BrandMark } from "./brand";
import Link from "./link";
import { AUTHOR_SECTIONS, type AuthorSection } from "@/components/author/navigation";
export function DashboardPreview({ white = false }: { white?: boolean }) {
  const [section, setSection] = useState<AuthorSection>("overview");
  const id = useId();
  const selected = AUTHOR_SECTIONS.find((item) => item.id === section)!;
  return (
    <div
      className={"dashboard-preview" + (white ? " partner-preview" : "")}
      aria-label="Anteprima interattiva dell’area autore con dati di esempio"
    >
      <div className="preview-sidebar">
        <BrandMark />
        <span>IL TUO SPAZIO</span>
        <div className="preview-nav" role="group" aria-label="Esplora l’anteprima dell’area autore">
          {AUTHOR_SECTIONS.map(({ id: key, name, icon: Icon }) => (
            <button
              type="button"
              key={key}
              aria-pressed={section === key}
              aria-controls={id}
              onClick={() => setSection(key)}
            >
              <Icon size={15} />
              <span>{name}</span>
              {key === "approvals" && <small>1</small>}
            </button>
          ))}
        </div>
        <div className="preview-project-label">
          La forma delle storie<small>Romanzo · progetto demo</small>
        </div>
      </div>
      <div className="preview-body" id={id}>
        <div className="preview-top">
          <span>{white ? "Il tuo brand" : "Proemios"} / area autore</span>
          <b>DEMO</b>
        </div>
        <h3>{section === "overview" ? "La tua storia prende forma." : selected.name}</h3>
        <p>
          {section === "overview"
            ? "Il prossimo passo è qui, insieme al tuo editor."
            : "La forma delle storie · dati di esempio"}
        </p>
        {section === "overview" || section === "project" ? (
          <>
            <div className="preview-cards">
              <div>
                <span>Fase del progetto</span>
                <strong>Revisione</strong>
                <small>In corso · 3 di 6 fasi</small>
                <div className="preview-progress">
                  <i />
                </div>
              </div>
              <div>
                <span>Il tuo prossimo passo</span>
                <strong>Rileggi il capitolo 01</strong>
                <small>Una revisione da approvare</small>
              </div>
            </div>
            <div className="preview-project-timeline">
              <b>Il percorso editoriale</b>
              <div>
                {[
                  "Manoscritto",
                  "Editing",
                  "Revisione",
                  "Copertina",
                  "Impaginazione",
                  "Pubblicazione",
                ].map((name, i) => (
                  <span key={name} className={i < 2 ? "done" : i === 2 ? "current" : ""}>
                    <i>{i < 2 ? <Check size={12} /> : i + 1}</i>
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <div className="preview-bottom-cards">
              <div>
                <span>Messaggi</span>
                <strong>Il tuo editor ti ha scritto</strong>
              </div>
              <div>
                <span>Pagamenti</span>
                <strong>Acconto registrato</strong>
              </div>
            </div>
          </>
        ) : section === "messages" ? (
          <div className="preview-message">
            <span>IL TUO EDITOR · ESEMPIO</span>
            <p>
              Ho preparato la revisione del primo capitolo. Rileggila con calma: possiamo
              confrontarci sulle scelte prima di proseguire.
            </p>
            <Link className="preview-action" href="/accedi?sezione=messages">
              Prova la conversazione nella demo
            </Link>
          </div>
        ) : section === "files" || section === "approvals" ? (
          <div className="preview-document">
            <FileText size={26} />
            <strong>Capitolo 01 · versione revisionata</strong>
            <span>Originale e revisione a confronto</span>
            <b>Da approvare</b>
            <Link className="preview-action" href={"/accedi?sezione=" + section}>
              Apri {section === "files" ? "i file" : "le approvazioni"} nella demo
            </Link>
          </div>
        ) : section === "payments" ? (
          <div className="preview-document">
            <ShieldCheck size={26} />
            <strong>Ogni importo, visibile</strong>
            <span>Acconto, saldo e stato del pagamento in un unico spazio.</span>
            <b>Acconto registrato · esempio</b>
            <Link className="preview-action" href="/accedi?sezione=payments">
              Esplora i pagamenti nella demo
            </Link>
          </div>
        ) : (
          <div className="preview-document">
            <FileText size={26} />
            <strong>I file finali del tuo libro</strong>
            <span>Testo approvato, copertina, PDF ed EPUB nei formati concordati.</span>
            <b>Si sbloccano al termine delle fasi</b>
            <Link className="preview-action" href="/accedi?sezione=deliveries">
              Esplora le consegne nella demo
            </Link>
          </div>
        )}
        <div className="preview-demo-caption">
          Anteprima con dati di esempio · nessuna transazione reale
        </div>
      </div>
    </div>
  );
}
