import type { ReactNode } from "react";
import { DashboardPreview } from "./dashboard-preview";
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow">
      <span />
      {children}
    </p>
  );
}
export function Dashboard({ hero = false, white = false }: { hero?: boolean; white?: boolean }) {
  return (
    <div
      className={
        "dashboard-wrap " + (hero ? "hero-dashboard" : "") + (white ? " white-dashboard" : "")
      }
    >
      <div className="dashboard-back back-one" />
      <div className="dashboard-back back-two" />
      <div className="dashboard-browser">
        <div className="browser-bar">
          <i />
          <i />
          <i />
          <span>{white ? "Il tuo spazio editoriale" : "proemios / il tuo spazio"}</span>
        </div>
        {white && (
          <div className="white-brand">
            IL TUO BRAND <span>Il progetto del tuo cliente</span>
          </div>
        )}
        <DashboardPreview white={white} />
      </div>
    </div>
  );
}
