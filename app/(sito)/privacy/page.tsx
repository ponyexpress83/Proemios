import type { Metadata } from "next";
import { DocumentoLegale, Dato } from "@/components/sezioni/documento-legale";
import { BRAND } from "@/config/brand";
import {
  TITOLARE,
  CONSERVAZIONE,
  RESPONSABILI_ESTERNI,
  AGGIORNAMENTO_DOCUMENTI,
} from "@/config/legal";
import { env } from "@/lib/env";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Privacy policy",
  descrizione:
    "Informativa sul trattamento dei dati personali di Proemios ai sensi del Regolamento (UE) 2016/679.",
  path: "/privacy",
});

export default function PrivacyPage() {
  const giorni = env.MANUSCRIPT_RETENTION_DAYS;

  return (
    <DocumentoLegale
      titolo="Informativa sulla privacy"
      aggiornamento={AGGIORNAMENTO_DOCUMENTI}
      premessa={
        <p>
          Questa informativa spiega quali dati personali raccogliamo tramite il sito {BRAND.domain},
          perché li raccogliamo, per quanto tempo li conserviamo e quali diritti puoi esercitare. È
          resa ai sensi degli articoli 13 e 14 del Regolamento (UE) 2016/679 («GDPR») e del D.lgs.
          196/2003 come modificato dal D.lgs. 101/2018. È scritta per essere letta: se qualcosa non
          ti è chiaro, scrivi a {BRAND.email.privacy}.
        </p>
      }
      sezioni={[
        {
          titolo: "Titolare del trattamento",
          contenuto: (
            <>
              <p>
                Il titolare del trattamento è <Dato valore={TITOLARE.ragioneSociale} /> (
                <Dato valore={TITOLARE.formaGiuridica} />
                ), con sede legale in <Dato valore={TITOLARE.sedeLegale} />, partita IVA{" "}
                <Dato valore={TITOLARE.partitaIva} />, codice fiscale{" "}
                <Dato valore={TITOLARE.codiceFiscale} />, iscritta al{" "}
                <Dato valore={TITOLARE.registroImprese} />.
              </p>
              <p className="mt-3">
                Contatti: {BRAND.email.privacy} · PEC <Dato valore={TITOLARE.pec} />.
              </p>
              <p className="mt-3">
                Responsabile della protezione dei dati (DPO): <Dato valore={TITOLARE.dpo} />. La
                nomina non è obbligatoria per l&rsquo;attività svolta e, ove assente, ogni richiesta
                in materia di protezione dei dati va indirizzata al titolare agli indirizzi sopra
                indicati.
              </p>
            </>
          ),
        },
        {
          titolo: "Dati che raccogliamo",
          contenuto: (
            <>
              <p>Trattiamo esclusivamente i dati che ci fornisci di tua iniziativa.</p>
              <ul className="mt-3 list-disc pl-5">
                <li>
                  <strong>Configuratore di preventivo</strong>: nome, indirizzo email, numero di
                  telefono (facoltativo), note libere e le informazioni sul progetto editoriale
                  inserite nei passaggi del configuratore.
                </li>
                <li>
                  <strong>Analisi del manoscritto</strong>: nome, indirizzo email, nome del file
                  caricato, conteggio delle parole, metriche calcolate e report generato. Il testo
                  integrale del manoscritto non viene archiviato (vedi punto 5).
                </li>
                <li>
                  <strong>Modulo di contatto</strong>: nome, email, telefono (facoltativo) e
                  contenuto del messaggio.
                </li>
                <li>
                  <strong>Modulo per agenzie</strong>: ragione sociale, nome del referente, email,
                  telefono, sito web, servizi esternalizzati e volume indicativo.
                </li>
                <li>
                  <strong>Lista d&rsquo;attesa degli strumenti in abbonamento</strong>: indirizzo
                  email e piano di interesse.
                </li>
                <li>
                  <strong>Dati tecnici</strong>: indirizzo IP e informazioni essenziali sulla
                  richiesta, trattati per la sicurezza del servizio e per limitare gli abusi (numero
                  massimo di analisi giornaliere per indirizzo).
                </li>
              </ul>
              <p className="mt-3">
                Non raccogliamo categorie particolari di dati (art. 9 GDPR). Se il testo che carichi
                o il messaggio che ci invii contiene dati di questo tipo, li trattiamo solo nella
                misura necessaria a eseguire il servizio richiesto e sulla base del tuo consenso
                esplicito.
              </p>
            </>
          ),
        },
        {
          titolo: "Finalità e basi giuridiche",
          contenuto: (
            <>
              <ul className="list-disc pl-5">
                <li>
                  <strong>Rispondere alle richieste, generare preventivi e report</strong>:
                  esecuzione di misure precontrattuali adottate su tua richiesta — art. 6, par. 1,
                  lett. b) GDPR.
                </li>
                <li>
                  <strong>Erogare i servizi acquistati e gestire i pagamenti</strong>: esecuzione
                  del contratto — art. 6, par. 1, lett. b) GDPR.
                </li>
                <li>
                  <strong>Adempimenti contabili, fiscali e di legge</strong>: obbligo legale — art.
                  6, par. 1, lett. c) GDPR.
                </li>
                <li>
                  <strong>Invio di guide e comunicazioni informative</strong>: consenso libero,
                  specifico e revocabile in ogni momento — art. 6, par. 1, lett. a) GDPR. Il
                  consenso è facoltativo e il suo rifiuto non pregiudica l&rsquo;accesso ai servizi.
                </li>
                <li>
                  <strong>Sicurezza del sito e prevenzione degli abusi</strong>: legittimo interesse
                  del titolare a garantire il funzionamento del servizio — art. 6, par. 1, lett. f)
                  GDPR.
                </li>
                <li>
                  <strong>
                    Accertamento, esercizio o difesa di un diritto in sede giudiziaria
                  </strong>
                  : legittimo interesse — art. 6, par. 1, lett. f) GDPR.
                </li>
              </ul>
              <p className="mt-3">
                Il conferimento dei dati contrassegnati come obbligatori nei moduli è necessario per
                dare seguito alla richiesta: senza di essi non possiamo produrre il preventivo, il
                report o risponderti.
              </p>
            </>
          ),
        },
        {
          titolo: "Analisi del manoscritto e strumenti automatici",
          contenuto: (
            <>
              <p>
                Il report di analisi è prodotto in due passaggi. Le metriche quantitative (conteggio
                delle parole, lunghezza media dei periodi, indice di leggibilità) sono calcolate sui
                nostri sistemi. Il giudizio editoriale è generato da un sistema automatico di
                elaborazione del linguaggio, al quale trasmettiamo un <strong>estratto</strong> del
                testo, pari indicativamente alle prime 8.000 parole.
              </p>
              <p className="mt-3">
                <strong>Il file che carichi non viene conservato.</strong> Ne estraiamo il testo,
                generiamo il report e cancelliamo l&rsquo;estratto entro {giorni} giorni. Del
                caricamento restano soltanto il nome del file, il conteggio delle parole e il report
                prodotto. Il tuo testo non è utilizzato per addestrare alcun modello, non è ceduto a
                terzi e non è impiegato per finalità diverse dall&rsquo;analisi richiesta.
              </p>
              <p className="mt-3">
                Il report non costituisce un processo decisionale automatizzato produttivo di
                effetti giuridici ai sensi dell&rsquo;art. 22 GDPR: è una valutazione indicativa,
                che non determina da sola l&rsquo;accesso ad alcun servizio e che viene comunque
                verificata da una persona prima di qualsiasi proposta contrattuale.
              </p>
              <p className="mt-3">{BRAND.aiDisclaimer}</p>
            </>
          ),
        },
        {
          titolo: "Periodi di conservazione",
          contenuto: (
            <>
              <ul className="list-disc pl-5">
                <li>
                  Richieste e preventivi non convertiti in contratto:{" "}
                  {CONSERVAZIONE.leadNonConvertiti}.
                </li>
                <li>Dati di clienti e documentazione contrattuale: {CONSERVAZIONE.clienti}.</li>
                <li>Estratti dei manoscritti analizzati: {giorni} giorni.</li>
                <li>Dati trattati sulla base del consenso: {CONSERVAZIONE.consensoMarketing}.</li>
                <li>Dati tecnici e log di sicurezza: {CONSERVAZIONE.logTecnici}.</li>
              </ul>
              <p className="mt-3">
                Decorsi tali termini i dati sono cancellati o resi anonimi in modo irreversibile,
                salvo che una diversa conservazione sia richiesta da un obbligo di legge o
                necessaria per la difesa di un diritto in giudizio.
              </p>
            </>
          ),
        },
        {
          titolo: "Destinatari dei dati",
          contenuto: (
            <>
              <p>
                I dati sono trattati dal titolare e dalle persone autorizzate al trattamento (art.
                29 GDPR), vincolate alla riservatezza. Possono inoltre essere trattati dai seguenti
                fornitori, nominati responsabili del trattamento ai sensi dell&rsquo;art. 28 GDPR:
              </p>
              <ul className="mt-3 list-disc pl-5">
                {RESPONSABILI_ESTERNI.map((r) => (
                  <li key={r.nome}>
                    <strong>{r.nome}</strong> — {r.ruolo} ({r.sede}).
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                Per l&rsquo;esecuzione di specifiche lavorazioni possiamo avvalerci di collaboratori
                professionali (editor, correttori, grafici, illustratori), anch&rsquo;essi vincolati
                da obblighi di riservatezza e istruiti per iscritto sul trattamento.
              </p>
              <p className="mt-3">
                I dati possono essere comunicati ad autorità pubbliche quando ciò sia imposto dalla
                legge. <strong>Non vendiamo e non cediamo i dati a terzi</strong> per finalità
                promozionali proprie di questi ultimi. Non è previsto alcun processo di
                profilazione.
              </p>
            </>
          ),
        },
        {
          titolo: "Trasferimenti fuori dallo Spazio economico europeo",
          contenuto: (
            <p>
              Alcuni dei fornitori indicati al punto precedente hanno sede o infrastrutture negli
              Stati Uniti. Il trasferimento avviene sulla base delle garanzie previste dal Capo V
              del GDPR: decisione di adeguatezza della Commissione europea, ove applicabile, oppure
              clausole contrattuali tipo adottate dalla Commissione ai sensi dell&rsquo;art. 46,
              par. 2, lett. c) GDPR, integrate da misure supplementari. Puoi richiedere copia delle
              garanzie adottate scrivendo a {BRAND.email.privacy}.
            </p>
          ),
        },
        {
          titolo: "I tuoi diritti",
          contenuto: (
            <>
              <p>Nei limiti previsti dagli articoli 15-22 del GDPR hai diritto di:</p>
              <ul className="mt-3 list-disc pl-5">
                <li>ottenere conferma del trattamento e accedere ai tuoi dati (art. 15);</li>
                <li>chiedere la rettifica dei dati inesatti o incompleti (art. 16);</li>
                <li>chiedere la cancellazione dei dati (art. 17);</li>
                <li>chiedere la limitazione del trattamento (art. 18);</li>
                <li>
                  ricevere i dati in formato strutturato e trasmetterli ad altro titolare (art. 20);
                </li>
                <li>
                  opporti al trattamento fondato sul legittimo interesse, per motivi connessi alla
                  tua situazione particolare (art. 21);
                </li>
                <li>
                  revocare in ogni momento i consensi prestati, senza che ciò pregiudichi la liceità
                  del trattamento effettuato prima della revoca.
                </li>
              </ul>
              <p className="mt-3">
                Le richieste vanno inviate a {BRAND.email.privacy}: rispondiamo senza ingiustificato
                ritardo e comunque entro un mese, prorogabile di due mesi in caso di particolare
                complessità, dandotene comunicazione.
              </p>
              <p className="mt-3">
                Se ritieni che il trattamento violi la normativa, hai diritto di proporre reclamo al{" "}
                <strong>Garante per la protezione dei dati personali</strong> (Piazza Venezia 11,
                00187 Roma — garante.it) o di ricorrere all&rsquo;autorità giudiziaria.
              </p>
            </>
          ),
        },
        {
          titolo: "Sicurezza",
          contenuto: (
            <p>
              Adottiamo misure tecniche e organizzative adeguate a proteggere i dati da distruzione,
              perdita, modifica, divulgazione o accesso non autorizzati: trasmissione cifrata (TLS),
              accesso alle aree riservate protetto da credenziali, minimizzazione dei dati
              conservati e cancellazione automatica degli estratti dei manoscritti. Nessun sistema è
              però sicuro in modo assoluto: in caso di violazione dei dati personali che comporti un
              rischio elevato per i tuoi diritti, ti informeremo senza ingiustificato ritardo ai
              sensi dell&rsquo;art. 34 GDPR.
            </p>
          ),
        },
        {
          titolo: "Cookie",
          contenuto: (
            <p>
              Il sito non utilizza cookie di profilazione né strumenti di tracciamento
              pubblicitario. Il dettaglio è nella{" "}
              <a href="/cookie" className="text-viola-chiaro underline underline-offset-2">
                cookie policy
              </a>
              .
            </p>
          ),
        },
        {
          titolo: "Modifiche a questa informativa",
          contenuto: (
            <p>
              Possiamo aggiornare questa informativa per adeguarla a modifiche normative o ai
              servizi offerti. La versione vigente è sempre quella pubblicata su questa pagina, con
              la data di ultimo aggiornamento in testa. In caso di modifiche sostanziali che
              incidano sui tuoi diritti te ne daremo comunicazione, ove abbiamo un recapito idoneo.
            </p>
          ),
        },
      ]}
    />
  );
}
