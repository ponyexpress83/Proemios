import { BRAND } from "./brand";
import { TITOLARE, FORO_COMPETENTE, AGGIORNAMENTO_DOCUMENTI } from "./legal";
import { DEPOSIT_RATE } from "./pricing";
import { termsVersion } from "@/lib/platform/config";

/**
 * Condizioni generali in forma testuale, versionate. È la copia che finisce
 * nel contratto (PDF e snapshot) al momento dell'accettazione: stesso
 * contenuto della pagina /termini, senza impaginazione. Chi modifica un testo
 * deve aggiornare entrambi e cambiare `termsVersion` in lib/platform/config.ts,
 * così i contratti già conclusi restano legati alla versione accettata.
 *
 * Nessuna clausola nuova: il testo è quello pubblicato il
 * {AGGIORNAMENTO_DOCUMENTI}. Le clausole specifiche per cliente non esistono
 * per scelta: la personalizzazione sta nella scheda d'ordine (dati strutturati).
 */
export type TermsSection = { title: string; paragraphs: string[] };
export const CONTRACT_TERMS_STATUS: "approved" | "draft" = "approved";
export function contractTerms(): { version: string; updated: string; status: typeof CONTRACT_TERMS_STATUS; sections: TermsSection[] } {
  const acconto = Math.round(DEPOSIT_RATE * 100), saldo = 100 - acconto;
  return {
    version: termsVersion,
    updated: AGGIORNAMENTO_DOCUMENTI,
    status: CONTRACT_TERMS_STATUS,
    sections: [
      { title: "Premessa", paragraphs: [
        `Queste condizioni regolano l'uso del sito ${BRAND.domain} e la fornitura dei servizi editoriali di ${BRAND.name}. Accettandole concludi un contratto: leggile prima di versare un acconto. Se sei un consumatore, restano ferme le tutele inderogabili del D.lgs. 206/2005 (Codice del Consumo).`,
      ] },
      { title: "Chi eroga il servizio", paragraphs: [
        `I servizi sono erogati da ${TITOLARE.ragioneSociale} (${TITOLARE.formaGiuridica}), con sede legale in ${TITOLARE.sedeLegale}, partita IVA ${TITOLARE.partitaIva}, iscritta al ${TITOLARE.registroImprese}. Contatti: ${BRAND.email.general} · PEC ${TITOLARE.pec}.`,
      ] },
      { title: "Oggetto", paragraphs: [
        "Forniamo servizi editoriali su commissione: valutazione del manoscritto, editing, correzione di bozze, scrittura su commissione (ghostwriting), impaginazione, progettazione della copertina, conversione in formato ebook, assistenza alla pubblicazione su piattaforme di self-publishing e alla gestione dell'ISBN.",
        "Il perimetro esatto della singola fornitura è quello indicato nel preventivo confermato per iscritto: quanto non vi è espressamente incluso non è compreso nel prezzo.",
      ] },
      { title: "Proprietà intellettuale dell'opera", paragraphs: [
        "Il manoscritto e l'opera restano di tua proprietà. Non acquisiamo diritti d'autore, morali o di utilizzazione economica sull'opera, né diritti di pubblicazione, in nessuna fase del rapporto.",
        "Nei lavori di scrittura su commissione, i diritti di utilizzazione economica sull'elaborato sono trasferiti al committente al saldo integrale del corrispettivo; chi ha materialmente redatto il testo rinuncia a rivendicarne la paternità pubblica e resta vincolato alla riservatezza. Restano fermi i diritti morali inderogabili previsti dalla Legge 633/1941.",
        "Al termine della lavorazione ti consegniamo i file sorgente prodotti (impaginato, copertina, ebook), così da non vincolarti a noi per le modifiche future. Restano di nostra titolarità i metodi e gli strumenti di lavoro interni, che non fanno parte della fornitura.",
        "Non utilizziamo la tua opera come esempio, portfolio o caso studio senza una tua autorizzazione scritta e specifica.",
      ] },
      { title: "Riservatezza", paragraphs: [
        "Il materiale che ci affidi è trattato come riservato e usato esclusivamente per eseguire il servizio concordato. Può essere condiviso solo con i collaboratori assegnati al progetto, a loro volta vincolati alla riservatezza. Non lo divulghiamo, non lo cediamo e non lo utilizziamo per finalità proprie. Su richiesta sottoscriviamo un accordo di riservatezza dedicato; per le agenzie l'accordo è la premessa del rapporto.",
      ] },
      { title: "Preventivi", paragraphs: [
        "I preventivi generati dal configuratore del sito sono stime calcolate sui dati che inserisci e non costituiscono offerta contrattuale vincolante. Lo stesso vale per la fascia di costo indicata nel report di analisi del manoscritto.",
        "Il prezzo diventa vincolante solo con la conferma scritta che ti inviamo dopo aver esaminato il materiale. Se il lavoro effettivamente necessario risulta inferiore alla stima, il prezzo viene ridotto; se risulta superiore, te lo comunichiamo prima di procedere e sei libero di non dare seguito senza alcun costo.",
        "Salvo diversa indicazione, il preventivo confermato ha validità di 30 giorni.",
      ] },
      { title: "Prezzi, acconto e pagamenti", paragraphs: [
        "I prezzi indicati sul sito si intendono in euro. L'eventuale IVA e le imposte applicabili sono indicate nel preventivo confermato secondo il regime fiscale del titolare.",
        `Per avviare la lavorazione è richiesto un acconto pari al ${acconto}% dell'importo concordato: l'acconto conferma l'incarico e riserva la finestra di lavorazione in calendario. Il restante ${saldo}% è dovuto secondo quanto stabilito nel preventivo confermato e comunque prima della consegna dei file finali, salvo diversa pattuizione scritta.`,
        "I pagamenti online sono gestiti da Stripe: non veniamo mai a conoscenza dei dati della tua carta. In caso di ritardato pagamento si applicano gli interessi di mora di legge; sospendiamo la lavorazione solo dopo averti sollecitato per iscritto e concesso un termine congruo.",
      ] },
      { title: "Tempi, consegne e revisioni", paragraphs: [
        "I tempi di consegna sono indicati nel preventivo confermato e decorrono dal versamento dell'acconto e dalla ricezione di tutti i materiali necessari. I ritardi nella consegna dei materiali o nei riscontri sulle bozze spostano di pari durata i termini successivi.",
        "Ogni fornitura comprende i giri di revisione indicati nel preventivo. Le revisioni si intendono relative a quanto concordato: interventi che modificano il perimetro del lavoro (riscritture di parti approvate, cambi di impostazione, nuovi contenuti) costituiscono lavorazione aggiuntiva e vengono quotati a parte, previa tua approvazione.",
        "Ti chiediamo di fornire riscontro sulle consegne entro 15 giorni. Decorso tale termine senza osservazioni, la consegna si intende approvata ai fini dell'avanzamento della lavorazione.",
        "Nessuna pubblicazione avviene senza la tua approvazione esplicita.",
      ] },
      { title: "I tuoi obblighi", paragraphs: [
        "Affidandoci il materiale garantisci che: sei titolare dei diritti necessari o hai ottenuto le autorizzazioni richieste; il contenuto non viola diritti di terzi, non è diffamatorio, non ha carattere illecito e non lede la riservatezza di persone identificabili; le informazioni che ci fornisci per il preventivo sono corrette e complete.",
        "Nei memoir e nei testi che coinvolgono persone reali resta a tuo carico la valutazione su riservatezza, reputazione e consenso dei terzi citati: possiamo segnalarti i passaggi critici, ma la decisione finale è tua. Ci manlevi da pretese di terzi fondate su contenuti da te forniti.",
      ] },
      { title: "Diritto di recesso del consumatore", paragraphs: [
        `Se sei un consumatore hai diritto di recedere dal contratto concluso a distanza entro 14 giorni dalla sua conclusione, senza doverne indicare il motivo (artt. 52 e seguenti del Codice del Consumo). Per esercitarlo è sufficiente una comunicazione esplicita a ${BRAND.email.general}.`,
        "Se chiedi che la lavorazione inizi durante il periodo di recesso, ce lo confermi espressamente: in tal caso, ai sensi dell'art. 57, comma 3, del Codice del Consumo, in caso di recesso sei tenuto a corrispondere l'importo proporzionale al lavoro già svolto fino alla comunicazione. Se il servizio è stato interamente eseguito con il tuo previo consenso espresso e con l'accettazione della perdita del diritto di recesso, il recesso non è più esercitabile (art. 59, comma 1, lett. a).",
        "I rimborsi dovuti sono effettuati entro 14 giorni con lo stesso mezzo di pagamento utilizzato, salvo diverso accordo.",
      ] },
      { title: "Interruzione della lavorazione", paragraphs: [
        "Puoi interrompere il progetto in qualsiasi momento: ti addebitiamo il lavoro effettivamente svolto fino a quel momento e ti consegniamo quanto prodotto. Possiamo a nostra volta recedere, restituendoti le somme non maturate, se il materiale si rivela sostanzialmente diverso da quello descritto, se manca la collaborazione necessaria a proseguire, o se emergono contenuti illeciti. In caso di disaccordo di fondo sul risultato preferiamo interrompere e restituire il non lavorato piuttosto che consegnare qualcosa che non ti rappresenta.",
      ] },
      { title: "Garanzie e limiti di responsabilità", paragraphs: [
        "Eseguiamo la prestazione con la diligenza professionale richiesta. Non garantiamo risultati commerciali: volumi di vendita, posizionamenti in classifica, recensioni o accoglienza critica. Nessuna comunicazione, sul sito o in trattativa, va intesa come promessa di successo editoriale o di guadagno.",
        "L'analisi automatica del manoscritto è una diagnosi preliminare indicativa: non è una perizia, non sostituisce la valutazione professionale completa e non impegna sul prezzo finale.",
        "Non rispondiamo dei ritardi o dei rifiuti delle piattaforme di pubblicazione di terzi, che applicano regole proprie sulle quali non abbiamo controllo, né di eventi di forza maggiore. Salvo dolo o colpa grave, e fermi restando i diritti inderogabili del consumatore, la nostra responsabilità complessiva è limitata all'importo corrisposto per la fornitura da cui è derivato il danno.",
      ] },
      { title: "Reclami, legge applicabile e foro", paragraphs: [
        `Per qualsiasi contestazione scrivi a ${BRAND.email.general}: cerchiamo sempre una soluzione diretta prima di ogni altra via.`,
        `Il contratto è regolato dalla legge italiana. Per le controversie con clienti che non rivestono la qualità di consumatore è competente in via esclusiva il ${FORO_COMPETENTE}. Se sei un consumatore, è competente il giudice del luogo della tua residenza o del tuo domicilio elettivo (art. 66-bis del Codice del Consumo).`,
        "In quanto consumatore puoi inoltre ricorrere alla piattaforma europea di risoluzione delle controversie online (ODR) messa a disposizione dalla Commissione europea.",
      ] },
      { title: "Modifiche alle condizioni", paragraphs: [
        "Possiamo aggiornare queste condizioni per adeguarle a modifiche normative o ai servizi offerti. Ai contratti già conclusi si applicano le condizioni vigenti al momento della conferma del preventivo; le modifiche non hanno effetto retroattivo.",
      ] },
    ],
  };
}
/**
 * Testi della scheda d'ordine che richiedono una scelta esplicita del cliente.
 * Riprendono la sezione «Diritto di recesso del consumatore» già pubblicata:
 * non introducono clausole nuove. Stato: da validare con il consulente legale
 * prima dell'uso con clienti reali (vedi docs/CONTRATTO_E_ACCETTAZIONE.md).
 */
export const ORDER_SHEET_TEXTS = {
  earlyStart:
    "Chiedo espressamente che la lavorazione inizi durante il periodo di recesso di 14 giorni. So che, in caso di recesso, dovrò corrispondere l'importo proporzionale al lavoro già svolto fino alla comunicazione e che, una volta eseguito interamente il servizio, il diritto di recesso non sarà più esercitabile (artt. 57 e 59 del Codice del Consumo).",
  withdrawal:
    `Se sei un consumatore puoi recedere entro 14 giorni dalla conclusione del contratto, senza motivazione, dalla tua area riservata o scrivendo a ${BRAND.email.general}. Il rimborso avviene entro 14 giorni con lo stesso mezzo di pagamento.`,
  startConditions:
    "La lavorazione parte dopo la conferma dell'acconto da parte del servizio di pagamento e dopo il caricamento dei materiali necessari. Il saldo è dovuto prima della consegna dei file finali.",
} as const;
