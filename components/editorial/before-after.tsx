"use client";
import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import Link from "./link";
import { Eyebrow } from "./elements";
import { Slider } from "./slider";
export function BeforeAfter() {
  const [v, setV] = useState(50);
  return (
    <section className="section before-section">
      <div className="before-grid container">
        <div className="manuscript">
          <div className="paper-base">
            <span className="paper-label">ORIGINALE</span>
            <p className="paper-chapter">CAPITOLO PRIMO</p>
            <h3>Il ritorno</h3>
            <p>
              Quando tornò al paese, lui si accorse che tutto era cambiato, ma anche tutto era
              rimasto uguale.
            </p>
            <p>
              Le case erano sempre li. E la piazza era sempre quella piazza che lui conosceva così
              bene.
            </p>
            <p>
              Si fermò per un momento. Pensava che forse non avrebbe dovuto tornare, ma era tornato.
            </p>
            <small>Testo dimostrativo, creato per questo confronto.</small>
          </div>
          <div className="paper-revised" style={{ clipPath: `inset(0 0 0 ${v}%)` }}>
            <span className="paper-label">REVISIONATO</span>
            <p className="paper-chapter">CAPITOLO PRIMO</p>
            <h3>Il ritorno</h3>
            <p>
              Quando tornò al paese,{" "}
              <mark>gli sembrò che tutto fosse diverso. Eppure riconosceva ogni angolo.</mark>
            </p>
            <p>
              Le case erano ancora <mark>lì</mark>. La piazza conservava{" "}
              <mark>le voci e le ombre che ricordava.</mark>
            </p>
            <p>
              Si fermò.{" "}
              <mark>Aveva esitato a lungo, prima di tornare. Adesso era di nuovo a casa.</mark>
            </p>
            <small>Una possibile revisione, da discutere con l’autore.</small>
          </div>
          <div className="comparison-line" style={{ left: v + "%" }}>
            <span>↔</span>
          </div>
          <Slider
            className="comparison-slider"
            value={[v]}
            onValueChange={(x) => setV(x[0] ?? 50)}
            min={0}
            max={100}
            step={1}
            aria-label="Posizione del confronto originale e revisionato"
          />
          <p className="slider-hint">
            Trascina per confrontare <span>← →</span>
          </p>
        </div>
        <div>
          <Eyebrow>LA CURA SI VEDE</Eyebrow>
          <h2>
            Dal manoscritto
            <br />
            alla versione
            <br />
            <em>pronta.</em>
          </h2>
          <div className="quality-tags">
            {["Correzione", "Stile", "Coerenza", "Chiarezza"].map((x) => (
              <span key={x}>
                <Check size={14} />
                {x}
              </span>
            ))}
          </div>
          <p>
            Tecnologia editoriale e supervisione professionale lavorano insieme. La decisione finale
            resta sempre umana.
          </p>
          <Link href="/servizi/editing" className="text-link">
            Il lavoro dietro ogni pagina <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
