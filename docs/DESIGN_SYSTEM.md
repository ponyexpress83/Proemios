# Proemios — Design System

Stato: vigente dalla Fase 1 di Complete v1. Sostituisce integralmente il
precedente sistema chiaro (carta/alloro/ottone), rimosso dal repository.

## 1. Identità

Proemios è uno studio editoriale integrato che vende un **risultato**, non uno
strumento. L'interfaccia deve leggersi come una piattaforma professionale
contemporanea: densa dove serve informazione, ampia dove serve respiro, mai
decorativa.

Registro: midnight + antracite, viola elettrico come identità, lime acido come
segnale. Nessuna metafora cartacea, nessun ottone, nessun filetto ornamentale.

## 2. Token

Tutti i token vivono in `app/globals.css` dentro `@theme` (Tailwind v4). **Un
componente non contiene mai un colore letterale**: se un valore serve e non
esiste, si aggiunge un token.

### Colore

| Token                                   | Valore                            | Uso                                 |
| --------------------------------------- | --------------------------------- | ----------------------------------- |
| `fondo`                                 | `#08080D`                         | fondale di pagina                   |
| `fondo-alto`                            | `#0D0D14`                         | fasce e sezioni sollevate           |
| `superficie`                            | `#14141D`                         | schede, pannelli, righe             |
| `superficie-alta`                       | `#191923`                         | modali, cassetti, schede in rilievo |
| `superficie-viva`                       | `#20202C`                         | hover, riga selezionata             |
| `testo`                                 | `#F6F4FA`                         | testo primario                      |
| `testo-attenuato`                       | `#A9A3BE`                         | testo secondario                    |
| `testo-tenue`                           | `#8C87A0`                         | meta, etichette                     |
| `viola`                                 | `#6C4BFF`                         | azione primaria, bordi attivi       |
| `viola-chiaro`                          | `#8B72FF`                         | viola **come testo**                |
| `viola-scuro`                           | `#4B2FD8`                         | stato premuto                       |
| `lime`                                  | `#B7FF3C`                         | CTA commerciale, indicatori         |
| `lime-scuro`                            | `#8FCE1F`                         | hover su lime                       |
| `successo` / `attenzione` / `errore`    | `#4ADE80` / `#FFB84D` / `#FF6B6B` | stati                               |
| `bordo` / `bordo-forte` / `bordo-viola` | alpha su bianco caldo             | separazioni                         |

Due regole non negoziabili:

1. **Il viola non si usa come testo.** `#6C4BFF` su `#08080D` sta a 3,87:1, sotto
   la soglia AA per il testo normale. Per il testo si usa `viola-chiaro`
   (5,64:1). `viola` resta un colore di fondo e di bordo.
2. **Il lime è raro.** CTA principale, indicatori di stato, il punto del
   marchio, un accento per sezione. Usato ovunque smette di segnalare.

### Tipografia

- **Geist** (`--font-sans`) — interfaccia e titoli. Tutto, salvo le eccezioni sotto.
- **Geist Mono** (`--font-mono`) — apparato tecnico: prezzi, conteggi, codici
  progetto, etichette di stato. Utility `.etichetta` e `.cifre`.
- **Instrument Serif** (`--font-serif`) — solo citazioni e occhielli editoriali.
  Utility `.editoriale`. Mai per l'interfaccia.

### Spaziatura, raggi, ombre, motion

Gabbia `82rem`, misura di lettura `42rem`. Raggi da `6px` a `30px`
(`--radius-xs` … `--radius-2xl`). Tre ombre (`sollevata`, `fluttuante`,
`viola`, `lime`) — nessun'altra. Una sola curva di animazione,
`--ease-garbo` (`cubic-bezier(.22,1,.36,1)`), esposta come utility `.garbo`.

## 3. Utility di composizione

`gabbia`, `lettura`, `etichetta`, `cifre`, `editoriale`, `garbo`,
`testo-identita`, `alone`. Definite in `app/globals.css`, documentate lì.

`testo-identita` forza l'interpolazione del gradiente `in oklab`: in sRGB il
punto medio fra viola e lime cade su un grigio-verde spento, in oklch la
rotazione di tinta passa dal ciano, che non è in palette.

## 4. Componenti

`components/ui/` è il design system. Nessuna pagina definisce stili propri per
cose che esistono qui.

| File                                              | Componenti                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `primitivi.tsx`                                   | `Gabbia` `Sezione` `Occhiello` `Titolo` `Filetto` `Etichetta` `Nota` `Dato` `Impaginato` `Folio` `NotaMargine` `Apertura` |
| `bottone.tsx`                                     | `Bottone` `BottoneLink` `BottoneIcona`                                                                                    |
| `scheda.tsx`                                      | `Scheda` `SchedaTestata` `SchedaCorpo` `SchedaPiede` `SchedaMetrica`                                                      |
| `badge.tsx`                                       | `Badge` `BadgeStato`                                                                                                      |
| `campi.tsx`                                       | `Campo` `Input` `AreaTesto` `Selezione` `Consenso` `ScelteScheda`                                                         |
| `tabella.tsx`                                     | `Tabella` `Riga` `Cella`                                                                                                  |
| `progresso.tsx`                                   | `Progresso` `AnelloProgresso`                                                                                             |
| `cronologia.tsx`                                  | `Cronologia` `Tappa`                                                                                                      |
| `stati.tsx`                                       | `StatoVuoto` `Scheletro` `ScheletroTesto` `Avviso`                                                                        |
| `modale.tsx` `cassetto.tsx` `tab.tsx` `toast.tsx` | overlay e navigazione, su Radix                                                                                           |

`Sezione` porta sempre la propria `Gabbia`: una pagina non deve ricordarsi di
annidarla. `senzaGabbia` è l'eccezione per le fasce a tutta larghezza.

Le varianti dei bottoni definiscono fondo, testo e bordo **insieme**: passare
solo un colore di fondo via `className` lascerebbe il testo della variante
precedente e produrrebbe combinazioni illeggibili a seconda dell'ordine nel CSS
generato.

## 5. Accessibilità

Obiettivo: **WCAG 2.1 AA**.

- Contrasti verificati: nessuna coppia testo/fondo del sistema scende sotto
  4,5:1 per il testo normale.
- Il colore non è mai l'unico veicolo di informazione: gli stati portano
  pallino + testo (`BadgeStato`, `Tappa`), i link inline sono sottolineati.
- Focus sempre visibile, in lime, mai rimosso.
- Overlay, accordion e tab sono su Radix: focus trap, `Esc`, `aria-*` e
  navigazione da tastiera non sono reimplementati a mano.
- `prefers-reduced-motion`: le transizioni si azzerano e i componenti animati
  (`Apparizione`, `OggettoEditoriale`) rendono il contenuto nella posa finale —
  mai contenuto invisibile in attesa di un'animazione soppressa.

Verifica automatica:

```sh
npm run build && npm run anteprima && npm run a11y
```

`scripts/accessibilita.mjs` esegue axe-core (tag `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa`) su nove pagine e esce con codice ≠ 0 alla prima
violazione. **Alla chiusura della Fase 1: zero violazioni.** Copre ciò che una
macchina può rilevare; la verifica con tastiera e screen reader resta manuale.

## 6. Prestazioni

L'oggetto 3D dell'hero (`components/marketing/oggetto-editoriale.tsx`) è fatto
di `div` con `transform` CSS: nessuna libreria 3D, nessun canvas. L'animazione
tocca solo `transform`, quindi resta sul compositor e non genera layout né
paint. Il listener del puntatore non viene registrato con `prefers-reduced-motion`
né su dispositivi senza puntatore fine. Senza JavaScript l'oggetto esiste
comunque, nella posa di riposo.

I font sono self-hosted da `next/font`: nessuna richiesta a runtime, nessun
layout shift.

## 7. Screenshot di verifica

```sh
npm run anteprima            # server di produzione su :3130
npm run schermate            # PNG delle pagine principali, desktop e mobile
```
