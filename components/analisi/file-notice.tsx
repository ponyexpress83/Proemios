import Link from "next/link";
import { BRAND } from "@/config/brand";
export function FileNotice({ demo, retention }: { demo: boolean; retention: number }) {
  return (
    <div className="manuscript-privacy">
      <strong>Prima di condividere il testo</strong>
      <p>
        Le metriche sono calcolate sull’intero file.{" "}
        {demo
          ? "In questa demo il giudizio editoriale è un esempio simulato, costruito sulle metriche: usa solo testi sintetici. Nome file, report e contatti restano temporaneamente nella memoria del server demo."
          : "Il giudizio editoriale è automatico: un estratto (fino a circa 8.000 parole) viene elaborato da Anthropic. Non è una lettura integrale di un editor."}
      </p>
      <p>
        Il testo integrale non viene archiviato nel database. Per il job si conserva un estratto
        in un archivio privato, insieme a metriche e report collegati al tuo account.
        {retention > 0 ? ` La configurazione prevista conserva il report per ${retention} giorni; l’attivazione richiede la verifica del processo di cancellazione.` : " I tempi di conservazione devono essere confermati prima dell’attivazione del servizio."} Per chiedere la
        cancellazione scrivi a <a href={"mailto:" + BRAND.email.privacy}>{BRAND.email.privacy}</a>.
      </p>
      <p>
        Il caricamento non trasferisce i diritti sull’opera. Licenze, attribuzione e riservatezza si
        definiscono nei termini e nel contratto; questa analisi non è un deposito dell’opera.
        Contatti e presa visione della privacy servono al report, mentre la stima anonima resta
        disponibile senza upload.
      </p>
      <div>
        <Link href="/privacy">Privacy e fornitori</Link>
        <Link href="/termini">Diritti e condizioni</Link>
      </div>
    </div>
  );
}
