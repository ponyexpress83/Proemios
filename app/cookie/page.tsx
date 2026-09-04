import type { Metadata } from "next";
import { DocumentoLegale, Dato } from "@/components/sezioni/documento-legale";
import { BRAND } from "@/config/brand";
import { TITOLARE, AGGIORNAMENTO_DOCUMENTI, CONSERVAZIONE } from "@/config/legal";
import { publicEnv } from "@/lib/env";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Cookie policy",
  descrizione: "Quali cookie e tecnologie simili utilizza il sito di Proemios.",
  path: "/cookie",
});

export default function CookiePage() {
  const analytics = Boolean(publicEnv.NEXT_PUBLIC_ANALYTICS_DOMAIN);

  return (
    <DocumentoLegale
      titolo="Cookie policy"
      aggiornamento={AGGIORNAMENTO_DOCUMENTI}
      premessa={
        <p>
          Il sito {BRAND.domain} è progettato per funzionare{" "}
          <strong>senza cookie di profilazione</strong> e senza strumenti di tracciamento
          pubblicitario. Per questo non trovi un banner che ti chiede di accettare: non c&rsquo;è
          nulla per cui sia richiesto il tuo consenso. Questa pagina spiega comunque, in modo
          verificabile, cosa viene impostato sul tuo dispositivo e perché.
        </p>
      }
      sezioni={[
        {
          titolo: "Cosa sono i cookie",
          contenuto: (
            <p>
              I cookie sono piccoli file di testo che i siti salvano sul dispositivo di chi li
              visita. Servono a far funzionare il sito, a ricordare preferenze o — quando sono di
              profilazione — a seguire il comportamento dell&rsquo;utente nel tempo. Ai sensi
              dell&rsquo;art. 122 del D.lgs. 196/2003 e delle Linee guida del Garante del 10 giugno
              2021, i soli cookie tecnici possono essere utilizzati senza consenso; tutti gli altri
              lo richiedono.
            </p>
          ),
        },
        {
          titolo: "Cookie tecnici (nessun consenso richiesto)",
          contenuto: (
            <>
              <p>
                Utilizziamo esclusivamente cookie tecnici e di sicurezza, necessari a erogare il
                servizio che hai richiesto. In particolare:
              </p>
              <ul className="mt-3 list-disc pl-5">
                <li>
                  cookie di sessione necessari al corretto funzionamento della navigazione e
                  all&rsquo;invio dei moduli;
                </li>
                <li>
                  credenziali di accesso all&rsquo;area riservata interna (
                  <code className="font-mono text-[0.9em]">/admin</code>), impostate solo per gli
                  operatori autorizzati;
                </li>
                <li>
                  parametri tecnici temporanei impiegati per limitare gli abusi sugli strumenti
                  gratuiti (numero massimo di analisi giornaliere).
                </li>
              </ul>
              <p className="mt-3">
                Questi elementi hanno durata di sessione o comunque non superiore a{" "}
                {CONSERVAZIONE.logTecnici} e non consentono di ricostruire il tuo comportamento di
                navigazione a fini commerciali.
              </p>
            </>
          ),
        },
        {
          titolo: "Statistiche di traffico",
          contenuto: analytics ? (
            <p>
              Raccogliamo statistiche aggregate sul traffico con una soluzione che{" "}
              <strong>non utilizza cookie</strong> e non impiega identificatori persistenti: i dati
              non consentono di risalire a te, non sono incrociati con altre fonti e non vengono
              condivisi con circuiti pubblicitari. Per questo la rilevazione non richiede consenso.
            </p>
          ) : (
            <p>
              Al momento non è attiva alcuna raccolta di statistiche sul traffico. Qualora venisse
              attivata, useremo una soluzione priva di cookie e di identificatori persistenti, e
              questa pagina verrà aggiornata prima dell&rsquo;attivazione.
            </p>
          ),
        },
        {
          titolo: "Servizi di terze parti",
          contenuto: (
            <>
              <p>
                Alcune funzioni si appoggiano a servizi esterni che possono impostare cookie propri{" "}
                <strong>soltanto nel momento in cui li utilizzi</strong>:
              </p>
              <ul className="mt-3 list-disc pl-5">
                <li>
                  <strong>Stripe</strong> — attivo solo durante il pagamento, per la sicurezza della
                  transazione e la prevenzione delle frodi. Sono cookie tecnici necessari
                  all&rsquo;esecuzione del servizio richiesto.
                </li>
                <li>
                  <strong>Servizio di calendario</strong> — attivo solo se apri il riquadro di
                  prenotazione nella pagina Contatti. Se preferisci non attivarlo, puoi scriverci
                  via email e fissiamo l&rsquo;orario manualmente.
                </li>
              </ul>
              <p className="mt-3">
                Questi fornitori operano come titolari autonomi per i cookie che impostano: per il
                dettaglio delle finalità e delle durate rimandiamo alle rispettive informative,
                consultabili sui loro siti.
              </p>
            </>
          ),
        },
        {
          titolo: "Come gestire i cookie dal browser",
          contenuto: (
            <>
              <p>
                Puoi bloccare o cancellare i cookie in qualsiasi momento dalle impostazioni del tuo
                browser, che di norma consentono anche di essere avvisati prima che un cookie venga
                salvato. La procedura è documentata nelle guide di Chrome, Firefox, Safari ed Edge.
              </p>
              <p className="mt-3">
                Tieni presente che bloccando i cookie tecnici alcune funzioni potrebbero smettere di
                funzionare correttamente, in particolare il pagamento online.
              </p>
            </>
          ),
        },
        {
          titolo: "Titolare e contatti",
          contenuto: (
            <p>
              Titolare del trattamento è <Dato valore={TITOLARE.ragioneSociale} />, con sede in{" "}
              <Dato valore={TITOLARE.sedeLegale} />. Per qualsiasi richiesta relativa a cookie e
              dati personali scrivi a {BRAND.email.privacy}. Il trattamento dei dati personali è
              descritto nell&rsquo;
              <a href="/privacy" className="text-viola-chiaro underline underline-offset-2">
                informativa sulla privacy
              </a>
              .
            </p>
          ),
        },
      ]}
    />
  );
}
