import { BrandMark } from "./brand";
export function DashboardPreview({ white = false }: { white?: boolean }) {
  return (
    <div
      className={"dashboard-preview" + (white ? " partner-preview" : "")}
      aria-label="Anteprima italiana dell’area autore, con dati di esempio"
    >
      <div className="preview-sidebar">
        <BrandMark />
        <span>Il tuo spazio</span>
        <b>Panoramica</b>
        <span>Il mio libro</span>
        <span>Messaggi</span>
        <span>File e revisioni</span>
        <span>Consegne</span>
      </div>
      <div className="preview-body">
        <div className="preview-top">
          <span>{white ? "Il tuo brand" : "Proemios"} / area autore</span>
          <b>DEMO</b>
        </div>
        <h3>La tua storia prende forma.</h3>
        <p>Un passo alla volta, insieme al tuo editor.</p>
        <div className="preview-cards">
          <div>
            <span>Il tuo progetto</span>
            <strong>La forma delle storie</strong>
            <small>Revisione in corso</small>
            <div className="preview-progress">
              <i />
            </div>
          </div>
          <div>
            <span>Prossimo passo</span>
            <strong>Rileggi il capitolo</strong>
            <small>Una revisione da approvare</small>
          </div>
        </div>
        <div className="preview-chart">
          <b>Il percorso editoriale</b>
          <div>
            {[35, 58, 48, 72, 66, 88, 78, 100].map((h, i) => (
              <i key={i} style={{ height: h + "%" }} />
            ))}
          </div>
          <span>Manoscritto → Editing → Revisione → Produzione</span>
        </div>
        <div className="preview-file">
          <span>Capitolo 01 · versione revisionata</span>
          <b>Da approvare</b>
        </div>
      </div>
    </div>
  );
}
