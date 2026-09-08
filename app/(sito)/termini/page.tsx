import type { Metadata } from "next";
import { DocumentoLegale, Dato } from "@/components/sezioni/documento-legale";
import { BRAND } from "@/config/brand";
import { TITOLARE, FORO_COMPETENTE, AGGIORNAMENTO_DOCUMENTI } from "@/config/legal";
import { DEPOSIT_RATE } from "@/config/pricing";
import { metadatiPagina } from "@/lib/seo";

export const metadata: Metadata = metadatiPagina({
  titolo: "Termini di servizio",
  descrizione: "Condizioni generali che regolano i servizi editoriali di Proemios.",
  path: "/termini",
});

export default function TerminiPage() {
  const acconto = Math.round(DEPOSIT_RATE * 100);
  const saldo = 100 - acconto;

  return (
    <DocumentoLegale
      titolo="Termini di servizio"
      aggiornamento={AGGIORNAMENTO_DOCUMENTI}
      premessa={
        <p>
          Queste condizioni regolano l&rsquo;uso del sito {BRAND.domain} e la fornitura dei servizi
          editoriali di {BRAND.name}. Accettandole concludi un contratto: leggile prima di versare
          un acconto. Se sei un consumatore, restano ferme le tutele inderogabili del D.lgs.
          206/2005 (Codice del Consumo).
        </p>
      }
      sezioni={[
        {
          titolo: "Chi eroga il servizio",
          contenuto: (
            <p>
              I servizi sono erogati da <Dato valore={TITOLARE.ragioneSociale} /> (
              <Dato valore={TITOLARE.formaGiuridica} />
              ), con sede legale in <Dato valore={TITOLARE.sedeLegale} />, partita IVA{" "}
              <Dato valore={TITOLARE.partitaIva} />, iscritta al{" "}
              <Dato valore={TITOLARE.registroImprese} />. Contatti: {BRAND.email.general} · PEC{" "}
              <Dato valore={TITOLARE.pec} />.
            </p>
          ),
        },
        {
          titolo: "Oggetto",
          contenuto: (
            <>
              <p>
                Forniamo servizi editoriali su commissione: valutazione del manoscritto, editing,
                correzione di bozze, scrittura su commissione (ghostwriting), impaginazione,
                progettazione della copertina, conversione in formato ebook, assistenza alla
                pubblicazione su piattaforme di self-publishing e alla gestione dell&rsquo;ISBN.
              </p>
              <p className="mt-3">
                Il perimetro esatto della singola fornitura è quello indicato nel preventivo
                confermato per iscritto: quanto non vi è espressamente incluso non è compreso nel
                prezzo.
              </p>
            </>
          ),
        },
        {
          titolo: "Proprietà intellettuale dell'opera",
          contenuto: (
            <>
              <p>
                <strong>Il manoscritto e l&rsquo;opera restano di tua proprietà.</strong> Non
                acquisiamo diritti d&rsquo;autore, morali o di utilizzazione economica sull&rsquo;
                opera, né diritti di pubblicazione, in nessuna fase del rapporto.
              </p>
              <p className="mt-3">
                Nei lavori di scrittura su commissione, i diritti di utilizzazione economica
                sull&rsquo;elaborato sono trasferiti al committente al saldo integrale del
                corrispettivo; chi ha materialmente redatto il testo rinuncia a rivendicarne la
                paternità pubblica e resta vincolato alla riservatezza. Restano fermi i diritti
                morali inderogabili previsti dalla Legge 633/1941.
              </p>
              <p className="mt-3">
                Al termine della lavorazione ti consegniamo i file sorgente prodotti (impaginato,
                copertina, ebook), così da non vincolarti a noi per le modifiche future. Restano di
                nostra titolarità i metodi e gli strumenti di lavoro interni, che non fanno parte
                della fornitura.
              </p>
              <p className="mt-3">
                Non utilizziamo la tua opera come esempio, portfolio o caso studio senza una tua
                autorizzazione scritta e specifica.
              </p>
            </>
          ),
        },
        {
          titolo: "Riservatezza",
          contenuto: (
            <p>
              Il materiale che ci affidi è trattato come riservato e usato esclusivamente per
              eseguire il servizio concordato. Può essere condiviso solo con i collaboratori
              assegnati al progetto, a loro volta vincolati alla riservatezza. Non lo divulghiamo,
              non lo cediamo e non lo utilizziamo per finalità proprie. Su richiesta sottoscriviamo
              un accordo di riservatezza dedicato; per le agenzie l&rsquo;accordo è la premessa del
              rapporto.
            </p>
          ),
        },
        {
          titolo: "Preventivi",
          contenuto: (
            <>
              <p>
                I preventivi generati dal configuratore del sito sono <strong>stime</strong>{" "}
                calcolate sui dati che inserisci e{" "}
                <strong>non costituiscono offerta contrattuale vincolante</strong>. Lo stesso vale
                per la fascia di costo indicata nel report di analisi del manoscritto.
              </p>
              <p className="mt-3">
                Il prezzo diventa vincolante solo con la conferma scritta che ti inviamo dopo aver
                esaminato il materiale. Se il lavoro effettivamente necessario risulta inferiore
                alla stima, il prezzo viene ridotto; se risulta superiore, te lo comunichiamo prima
                di procedere e sei libero di non dare seguito senza alcun costo.
              </p>
              <p className="mt-3">
                Salvo diversa indicazione, il preventivo confermato ha validità di 30 giorni.
              </p>
            </>
          ),
        },
        {
          titolo: "Prezzi, acconto e pagamenti",
          contenuto: (
            <>
              <p>
                I prezzi indicati sul sito si intendono in euro. L&rsquo;eventuale IVA e le imposte
                applicabili sono indicate nel preventivo confermato secondo il regime fiscale del
                titolare.
              </p>
              <p className="mt-3">
                Per avviare la lavorazione è richiesto un acconto pari al{" "}
                <strong>{acconto}%</strong> dell&rsquo;importo concordato: l&rsquo;acconto conferma
                l&rsquo;incarico e riserva la finestra di lavorazione in calendario. Il restante{" "}
                {saldo}% è dovuto secondo quanto stabilito nel preventivo confermato e comunque
                prima della consegna dei file finali, salvo diversa pattuizione scritta.
              </p>
              <p className="mt-3">
                I pagamenti online sono gestiti da Stripe: non veniamo mai a conoscenza dei dati
                della tua carta. In caso di ritardato pagamento si applicano gli interessi di mora
                di legge; sospendiamo la lavorazione solo dopo averti sollecitato per iscritto e
                concesso un termine congruo.
              </p>
            </>
          ),
        },
        {
          titolo: "Tempi, consegne e revisioni",
          contenuto: (
            <>
              <p>
                I tempi di consegna sono indicati nel preventivo confermato e decorrono dal
                versamento dell&rsquo;acconto e dalla ricezione di tutti i materiali necessari. I
                ritardi nella consegna dei materiali o nei riscontri sulle bozze spostano di pari
                durata i termini successivi.
              </p>
              <p className="mt-3">
                Ogni fornitura comprende i giri di revisione indicati nel preventivo. Le revisioni
                si intendono relative a quanto concordato: interventi che modificano il perimetro
                del lavoro (riscritture di parti approvate, cambi di impostazione, nuovi contenuti)
                costituiscono lavorazione aggiuntiva e vengono quotati a parte, previa tua
                approvazione.
              </p>
              <p className="mt-3">
                Ti chiediamo di fornire riscontro sulle consegne entro 15 giorni. Decorso tale
                termine senza osservazioni, la consegna si intende approvata ai fini
                dell&rsquo;avanzamento della lavorazione.
              </p>
              <p className="mt-3">
                <strong>Nessuna pubblicazione avviene senza la tua approvazione esplicita.</strong>
              </p>
            </>
          ),
        },
        {
          titolo: "I tuoi obblighi",
          contenuto: (
            <>
              <p>Affidandoci il materiale garantisci che:</p>
              <ul className="mt-3 list-disc pl-5">
                <li>
                  sei titolare dei diritti necessari o hai ottenuto le autorizzazioni richieste;
                </li>
                <li>
                  il contenuto non viola diritti di terzi, non è diffamatorio, non ha carattere
                  illecito e non lede la riservatezza di persone identificabili;
                </li>
                <li>le informazioni che ci fornisci per il preventivo sono corrette e complete.</li>
              </ul>
              <p className="mt-3">
                Nei memoir e nei testi che coinvolgono persone reali resta a tuo carico la
                valutazione su riservatezza, reputazione e consenso dei terzi citati: possiamo
                segnalarti i passaggi critici, ma la decisione finale è tua. Ci manlevi da pretese
                di terzi fondate su contenuti da te forniti.
              </p>
            </>
          ),
        },
        {
          titolo: "Diritto di recesso del consumatore",
          contenuto: (
            <>
              <p>
                Se sei un consumatore hai diritto di recedere dal contratto concluso a distanza
                entro <strong>14 giorni</strong> dalla sua conclusione, senza doverne indicare il
                motivo (artt. 52 e seguenti del Codice del Consumo). Per esercitarlo è sufficiente
                una comunicazione esplicita a {BRAND.email.general}.
              </p>
              <p className="mt-3">
                Se chiedi che la lavorazione inizi durante il periodo di recesso, ce lo confermi
                espressamente: in tal caso, ai sensi dell&rsquo;art. 57, comma 3, del Codice del
                Consumo, in caso di recesso sei tenuto a corrispondere l&rsquo;importo proporzionale
                al lavoro già svolto fino alla comunicazione. Se il servizio è stato{" "}
                <strong>interamente eseguito</strong> con il tuo previo consenso espresso e con
                l&rsquo;accettazione della perdita del diritto di recesso, il recesso non è più
                esercitabile (art. 59, comma 1, lett. a).
              </p>
              <p className="mt-3">
                I rimborsi dovuti sono effettuati entro 14 giorni con lo stesso mezzo di pagamento
                utilizzato, salvo diverso accordo.
              </p>
            </>
          ),
        },
        {
          titolo: "Interruzione della lavorazione",
          contenuto: (
            <p>
              Puoi interrompere il progetto in qualsiasi momento: ti addebitiamo il lavoro
              effettivamente svolto fino a quel momento e ti consegniamo quanto prodotto. Possiamo a
              nostra volta recedere, restituendoti le somme non maturate, se il materiale si rivela
              sostanzialmente diverso da quello descritto, se manca la collaborazione necessaria a
              proseguire, o se emergono contenuti illeciti. In caso di disaccordo di fondo sul
              risultato preferiamo interrompere e restituire il non lavorato piuttosto che
              consegnare qualcosa che non ti rappresenta.
            </p>
          ),
        },
        {
          titolo: "Garanzie e limiti di responsabilità",
          contenuto: (
            <>
              <p>
                Eseguiamo la prestazione con la diligenza professionale richiesta.{" "}
                <strong>
                  Non garantiamo risultati commerciali: volumi di vendita, posizionamenti in
                  classifica, recensioni o accoglienza critica.
                </strong>{" "}
                Nessuna comunicazione, sul sito o in trattativa, va intesa come promessa di successo
                editoriale o di guadagno.
              </p>
              <p className="mt-3">
                L&rsquo;analisi automatica del manoscritto è una diagnosi preliminare indicativa:
                non è una perizia, non sostituisce la valutazione professionale completa e non
                impegna sul prezzo finale.
              </p>
              <p className="mt-3">
                Non rispondiamo dei ritardi o dei rifiuti delle piattaforme di pubblicazione di
                terzi, che applicano regole proprie sulle quali non abbiamo controllo, né di eventi
                di forza maggiore. Salvo dolo o colpa grave, e fermi restando i diritti inderogabili
                del consumatore, la nostra responsabilità complessiva è limitata all&rsquo;importo
                corrisposto per la fornitura da cui è derivato il danno.
              </p>
            </>
          ),
        },
        {
          titolo: "Reclami, legge applicabile e foro",
          contenuto: (
            <>
              <p>
                Per qualsiasi contestazione scrivi a {BRAND.email.general}: cerchiamo sempre una
                soluzione diretta prima di ogni altra via.
              </p>
              <p className="mt-3">
                Il contratto è regolato dalla <strong>legge italiana</strong>. Per le controversie
                con clienti che non rivestono la qualità di consumatore è competente in via
                esclusiva il foro di <Dato valore={FORO_COMPETENTE} />. Se sei un consumatore, è
                competente il giudice del luogo della tua residenza o del tuo domicilio elettivo
                (art. 66-bis del Codice del Consumo).
              </p>
              <p className="mt-3">
                In quanto consumatore puoi inoltre ricorrere alla piattaforma europea di risoluzione
                delle controversie online (ODR) messa a disposizione dalla Commissione europea.
              </p>
            </>
          ),
        },
        {
          titolo: "Modifiche alle condizioni",
          contenuto: (
            <p>
              Possiamo aggiornare queste condizioni per adeguarle a modifiche normative o ai servizi
              offerti. Ai contratti già conclusi si applicano le condizioni vigenti al momento della
              conferma del preventivo; le modifiche non hanno effetto retroattivo.
            </p>
          ),
        },
      ]}
    />
  );
}
