# Proemios — Piano di design

> Da approvare **prima** di implementare il design system (§4 del brief). Nessun CSS
> di superficie è ancora scritto: `app/globals.css` contiene solo i reset e il
> rispetto di `prefers-reduced-motion`.

## Concetto

Il sito **è una pagina di libro composta**. Non "ispirato ai libri": costruito con
i dispositivi reali della tipografia — la **gabbia**, i **margini**, i **filetti**,
le **note a margine**, i **folî** (numeri di pagina), il **colophon**, le
**segnature**. Il nome *Proemios* è l'apertura dell'opera: ogni sezione si apre come
un proemio, con un **versale** (capolettera) grande e un filetto sottile.

Il prodotto ha due anime e il design le mette in **contrasto voluto**:

- **Casa editrice** (pagine di contenuto): impaginazione classica, misura di lettura
  da libro, marginalia, calma tipografica.
- **Software** (configuratore di preventivo, report di analisi): registro da
  **apparato critico / scheda tecnica** — fondo scuro, monospazio, dati densi,
  tabelle a filetti. Preciso come l'apparato di un'edizione filologica.

Questo salto di registro tra le due anime è **l'elemento-firma**.

## Cosa questo design NON è (vincoli del brief, rispettati)

- **No** crema `#F4F1EA` + serif ad alto contrasto + terracotta: è il default
  riconoscibile dell'AI. La nostra carta è più fredda e l'accento è **verde
  bottiglia**, non terracotta.
- **No** iconografia AI: niente nodi, reti neurali, gradienti viola, particelle.
- **No** Playfair di default: la display è **Fraunces**, che ha voce.

## Palette (6 valori nominati)

| Nome | Hex | Ruolo |
|------|-----|-------|
| **Carta** | `#F4F4F0` | Sfondo principale (bianco carta, neutro-freddo, non crema) |
| **Inchiostro** | `#1B1A17` | Testo e titoli (nero caldo di stampa, non `#000`) |
| **Alloro** | `#22483B` | Accento primario — verde bottiglia da tela di rilegatura |
| **Ottone** | `#9C7A3D` | Accento secondario, usato con parsimonia (folî, filetti, hover); come una stampa a caldo |
| **Grigio stampa** | `#6C6F67` | Testo secondario, note a margine |
| **Notte tipografica** | `#14201B` | Superfici del lato "software" (verde-nero, non blu navy) |

Il verde bottiglia + ottone su carta evoca i classici rilegati in tela (la tradizione
editoriale italiana, da Einaudi ad Adelphi) senza citare nessuno. È distintivo,
autorevole, e lontanissimo dall'estetica "AI startup".

## Tipografia (3 famiglie, ruoli distinti)

1. **Fraunces** — *display*. Titoli e il nome *Proemios*. Serif "old-style" con
   carattere e asse ottico: calda ma affilata, letteraria, non abusata come Playfair.
   Usata grande, nei versali di apertura sezione.
2. **Spectral** — *lettura*. Corpo del testo lungo, pensato per lo schermo come un
   libro ben composto: misura **62–70 caratteri**, interlinea generosa (~1.7),
   corsivo vero per le glosse a margine.
3. **IBM Plex Sans + IBM Plex Mono** — *interfaccia e apparato tecnico* (una
   superfamiglia, due ruoli). Plex Sans per nav, bottoni, form. Plex **Mono** per i
   numerici: prezzi, metriche del report, folî `§ 01`, etichette da scheda tecnica.
   È la voce "software" del brand.

Tutti i font self-hosted via `next/font` (zero layout shift, Lighthouse ≥ 95).

## Layout: la gabbia

Griglia asimmetrica a due colonne:

```
┌───────────┬─────────────────────────────────────────┐
│  margine  │  specchio di stampa                      │
│           │                                          │
│  § 01     │  V ersale di apertura (Fraunces, grande) │
│           │  ────────────────────────── filetto      │
│  nota a   │  Testo di lettura in Spectral, misura    │
│  margine  │  62–70 caratteri, interlinea ampia.      │
│  (glossa) │                                          │
│  ↳ folio  │  Blocchi, elenchi, filetti fra sezioni.  │
└───────────┴─────────────────────────────────────────┘
```

- **Colonna margine** (outer): folî di sezione (`§ 01`, `§ 02`…), brevi glosse in
  corsivo, metadati correnti. È l'apparato che rende la pagina "un libro".
- **Filetti** (hairline 1px, inchiostro/alloro a bassa opacità) separano le sezioni
  come le righe di una pagina composta.
- **Aperture di sezione** con **versale** oversize in Fraunces + filetto: il gesto
  "proemio". Qui si concentra l'audacia; tutto il resto resta disciplinato.
- **Colophon** nel footer: segnatura, metadati di produzione, la formula sull'AI.

### Lato software (configuratore + report)
La stessa gabbia **si ribalta** su **Notte tipografica**: registro apparato critico,
Plex Mono, tabelle a filetti, densità informativa. Micro-interazioni sobrie (un
filetto che si estende, un valore che si aggiorna). Nessun effetto decorativo.

## Mobile-first (reale)
- La colonna margine collassa; i folî diventano piccoli riferimenti inline.
- Il configuratore è uno **stepper a colonna singola**, comodo con una mano: numerici
  Plex Mono grandi, tocco ampio, barra di avanzamento a filetto.

## Motion
Sobrio e funzionale: i filetti si "compongono" allo scroll, i valori del preventivo
si aggiornano con una transizione minima. Niente parallax, niente particelle.
`prefers-reduced-motion` sempre rispettato. Contrasto AA, focus visibile, navigazione
da tastiera.

## Prossimo passo
Alla tua approvazione implemento: token in `globals.css` (Tailwind 4 `@theme`),
`next/font`, i primitivi (Gabbia, Sezione, Versale, Filetto, NotaMargine, Bottone,
Scheda) e poi le pagine. Se vuoi cambiare un accento (es. verde bottiglia → blu
notte-Sellerio, o ottone → rame), dimmelo ora: è il momento più economico per farlo.
