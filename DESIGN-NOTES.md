# Proemios — Note di design del sito pubblico

Redesign «Matita rossa e blu». Questo file è il registro del lavoro: cosa ha
trovato l'audit, i token, le decisioni e perché, l'autocritica a ogni passaggio,
e i punti di logica trovati strada facendo che **non** sono stati corretti perché
non spettava alla grafica.

Strumenti di misura: `scripts/audit-design.mjs` (screenshot, inventario degli
stili calcolati, axe-core) e Lighthouse 13 in emulazione mobile. Il «prima» sta
in `design-audit/before/`, il «dopo» in `design-audit/after/`, prodotti con lo
stesso script, così il confronto è onesto.

---

## Fase A — Audit (7 ottobre 2026, build di produzione, `next start`)

Il brief parlava di «oltre 25 font-size diversi, 12 radius, 8 ombre, 15 colori
di sfondo». Misurando tutti gli elementi visibili di 15 pagine a 4 larghezze,
il conto è più alto.

| Misura | Trovato | Obiettivo |
|---|---|---|
| Font-size distinti | **71** | 7 token |
| Famiglie di font caricate | **5** (Interface, Editorial, Geist, Geist Mono, Instrument Serif) | 2 |
| Border-radius distinti | **19** | 3 |
| Ombre distinte | **11** | 2 |
| Colori di sfondo distinti | **41** | ≈ 6 |
| Colori di testo distinti | **31** | ≈ 6 |
| Home a 375 px | **11 727 px** di altezza | ≤ 9 000 |
| Testi sotto i 13 px (home, 375) | **85** elementi | 0 |
| Target sotto 44 px (home, 375) | **40** | 0 |
| axe serious/critical (15 pagine × 2 larghezze) | 4 | 0 |
| Lighthouse mobile, home | Perf **52** · LCP **5,3 s** · FCP 3,1 s · TBT 1 000 ms · 656 KiB | ≥ 95 · < 2 s · < 1,2 s · < 400 KB |
| Lighthouse mobile, /preventivo | Perf 95 · LCP 1,8 s | — |

Le tre famiglie Google (Geist, Geist Mono, Instrument Serif) non erano un
residuo innocuo: le usano il configuratore, i moduli, il catalogo dei servizi e
l'area riservata, quindi ogni pagina pubblica caricava cinque famiglie.

### Il motivo dell'LCP a 5 secondi

Lighthouse scompone l'LCP della home così: TTFB 29 ms, **ritardo di rendering
dell'elemento 5 247 ms**. L'elemento è l'H1. La causa sta in
`app/editorial.css:2905`:

```css
.proemios-public .hero-copy > h1 { animation: reveal 0.7s both; }
```

`both` applica il primo fotogramma — `opacity: 0` — finché l'animazione non
parte, e l'animazione non parte finché non è applicato il CSS bloccante (due
fogli, ~1,6 s di attesa stimata su mobile) e finché il thread principale non è
libero (TBT 1 000 ms: la home è un unico albero di componenti client). Poi il
font Editorial, un OTF da 110 KB non precaricato, arriva con `font-display:
swap` e ridisegna il titolo. Tre ritardi in fila sullo stesso elemento. Il
rimedio non è ottimizzare l'animazione: è non animare l'H1, precaricare i due
pesi usati sopra la piega in woff2, e rendere statica la pagina.

### Difetti visibili confermati

- `/servizi`: sei gruppi su sette **vuoti** nello screenshot a pagina intera.
  Lo scroll-reveal (`components/marketing/apparizione.tsx`, `motion`) tiene le
  card a `opacity: 0` finché non entrano nel viewport; sotto la piega la pagina
  è bianca. Stesso meccanismo della sezione «Prima di iniziare» citata nel brief.
- Hamburger a 1 050 px (brief: 800 sul deploy di riferimento): in ogni caso
  sotto la soglia utile; la navigazione completa deve reggere fino a 1 024.
- Home: 8 H2 su 8 con una parola in corsivo corallo; eyebrow in maiuscolo con
  trattino su ogni sezione; numerazione 01–04 sui percorsi, 01–05 sui servizi,
  01/06 nell'«orbita»; card pastello (pesca, lavanda, salvia, corallo chiaro);
  «Amazon KDP · ISBN · Metadati» con punto mediano; chevron ↗ (link esterno) su
  link interni; freccia ↗ anche sui pulsanti.
- `/preventivo` a 375 px: il configuratore sta in un pannello navy con i token
  del tema scuro; l'anteprima dei prezzi è **sotto** i passi, fuori dallo
  schermo mentre si risponde; «Avanti →» grigio e disabilitato senza spiegazione.
- Due font per i numeri: `cifre` → Geist Mono. Prezzi come `1.760 €` ma senza
  spazio non separabile.
- H3 duplicati: «Il ritorno» compare due volte nel confronto prima/dopo (i due
  fogli sovrapposti); servizi in doppio DOM desktop/mobile (griglia + accordion).

---

## Fase B — Piano

### 1. Token

Tutto in `app/globals.css`, dentro `@theme` di Tailwind 4: le utility
(`bg-carta`, `text-inchiostro`, `rounded-foglio`, `text-t-md`…) nascono dai
token e un componente non contiene mai un valore scritto a mano. Le aree
riservate conservano il proprio sistema scuro (`docs/DESIGN_SYSTEM.md`); i
token del sito pubblico si chiamano diversamente apposta, così non si possono
confondere.

#### Colore

| Token | Hex | Uso |
|---|---|---|
| `carta` | `#FAFAF7` | sfondo principale |
| `carta-ombra` | `#F0F0EB` | sezioni alternate, campi dei form |
| `inchiostro` | `#131936` | testo, testata, fondo delle sezioni scure |
| `grafite` | `#565B69` | testo secondario |
| `rosso-matita` | `#C8202A` | azione primaria, segni di correzione, stato attivo |
| `blu-matita` | `#24408E` | link, evidenze di sostanza, anello di focus |
| `filetto` | `#DEDFE3` | bordi e filetti |
| `bianco` | `#FFFFFF` | fogli (card) sopra la carta |
| `carta-su-inchiostro` | `#FAFAF7` | testo e focus sulle sezioni scure |
| `grafite-su-inchiostro` | `#B9BDCA` | testo secondario sulle sezioni scure (aggiunto: `grafite` su `inchiostro` dà 2,54:1) |
| `rosso-su-inchiostro` | `#E8656D` | segni di correzione sulle sezioni scure (aggiunto: `rosso-matita` su `inchiostro` dà 3,03:1, va bene per un pulsante, non per un tratto sottile) |
| `esito-ok` | `#1F6B45` | conferme |
| `esito-errore` | `#C8202A` | errori (lo stesso rosso: un errore è una correzione) |

Regole: niente fondi pastello; il rosso solo per l'azione primaria e i segni;
sulle sezioni scure link e focus usano `carta-su-inchiostro`.

#### Contrasti (calcolati, WCAG 2.x)

| Coppia | Rapporto | Esito |
|---|---|---|
| inchiostro su carta | 16,46:1 | AA |
| inchiostro su carta-ombra | 15,06:1 | AA |
| grafite su carta | 6,49:1 | AA |
| grafite su carta-ombra | 5,93:1 | AA |
| grafite su bianco | 6,78:1 | AA |
| blu-matita su carta | 9,13:1 | AA |
| blu-matita su bianco | 9,55:1 | AA |
| rosso-matita su carta (testo) | 5,43:1 | AA |
| rosso-matita su carta-ombra | 4,97:1 | AA |
| bianco su rosso-matita (pulsante) | 5,68:1 | AA |
| carta su inchiostro | 16,46:1 | AA |
| grafite-su-inchiostro su inchiostro | 7,8:1 | AA |
| rosso-su-inchiostro su inchiostro | 4,6:1 | AA |
| **blu-matita su inchiostro** | **1,80:1** | **no** → sulle sezioni scure i link usano carta |
| rosso-matita su inchiostro (pulsante vs fondo) | 3,03:1 | ok come elemento d'interfaccia |
| filetto su carta | 1,27:1 | è un bordo, non testo: non soggetto |

#### Tipografia

- **Editorial** (serif, P052) per titoli, estratti, citazioni, testo lungo
  editoriale. **Interface** (sans, Nimbus Sans) per interfaccia, navigazione,
  form, corpo testo informativo. Servite con `next/font/local` in woff2
  (convertite con fontTools dagli OTF già nel repository, licenza AGPL-3 con
  eccezione font che lo consente), `adjustFontFallback`, preload solo dei due
  pesi usati sopra la piega: Editorial regolare e Interface regolare.
- Geist, Geist Mono e Instrument Serif escono dal progetto. Le variabili
  `--font-sans`, `--font-serif`, `--font-mono` restano, così le aree riservate
  continuano a funzionare: puntano a Interface, Editorial e Interface con
  `tabular-nums`. Nessun font nuovo.
- Scala modulare 1,25, base 17 px, sette dimensioni con `clamp()`:

| Token | Valore | Uso |
|---|---|---|
| `t-xs` | 13,5 px | note, didascalie, etichette (mai sotto i 13) |
| `t-sm` | 15 px | testo secondario, campi |
| `t-base` | 17 px | corpo |
| `t-md` | 21 px | lead, H4 |
| `t-lg` | 27 px | H3 |
| `t-xl` | 36 px | H2 |
| `t-display` | `clamp(44px, 6vw, 72px)` | H1 |

- Interlinea 1,6 serif, 1,5 sans, titoli 1,05–1,15. Giustezza 60–72 caratteri
  (`max-width: 68ch` sul testo corrente).
- Niente corsivo colorato nei titoli. Corsivo solo per titoli di opere e
  citazioni. Niente maiuscolo spaziato: se serve un'etichetta di sezione,
  maiuscoletto vero (`font-variant-caps: all-small-caps`) in grafite, senza
  trattino, solo dove orienta.
- Apostrofi e virgolette tipografiche (’ « »), spazio non separabile prima di €.

#### Spaziatura, forma, profondità

- Griglia 12 colonne, contenuto max 1 200 px, gutter 24 px (16 su mobile).
- Scala a 8 px: 4, 8, 12, 16, 24, 32, 48, 72, 112. Fra le sezioni 112 px
  desktop, 72 mobile.
- Tre radius: `campo` 4 px, `foglio` 12 px, `pillola` 999 px.
- Due ombre: `ombra-foglio` (`0 1px 0 filetto, 0 12px 24px -12px rgb(19 25 54
  / .18)`) e `ombra-sollevata` (solo menu e popover).
- Filetti da 1 px al posto delle card dove serve solo separare.

#### Motion

- Nessuno scroll-reveal. Le animazioni che rispondono a un'azione durano
  150–250 ms. Con `prefers-reduced-motion: reduce` non c'è animazione: lo stato
  finale appare subito.
- Tre soli segni animati: l'inserimento nell'H1 della home (una volta, 700 ms,
  il titolo è leggibile da subito perché si anima solo il tratto), i segni di
  correzione nel confronto prima/dopo, la sottolineatura a matita dei link al
  passaggio del mouse.

### 2. Elemento firma — i segni di correzione

Un set di SVG a tratto di matita, `components/sito/segni.tsx`: inserimento
(⁁), cancellatura, sottolineatura, segno a margine, freccia di spostamento.
Tratto in `rosso-matita` o `blu-matita`, `stroke-linecap: round`, leggera
irregolarità disegnata a mano, nessun filtro. Si tracciano con
`stroke-dashoffset`.

### 3. Wireframe

#### Home, 375 px (obiettivo: pulsanti dentro 375 × 667)

```
┌──────────────────────────────────┐
│ Demo: i dati non vengono salvati │  fascia, 13,5 px, solo se NEXT_PUBLIC_DEMO_MODE≠off
├──────────────────────────────────┤
│ [P] Proemios          Area autori ≡│  56 px
├──────────────────────────────────┤
│                                  │
│ Dai forma alla ⁁ storia.         │  H1 t-display (44 px), il ⁁ rosso si traccia
│   (tua)                          │  e inserisce «tua»
│                                  │
│ Editing, impaginazione e pubbli- │  sottotitolo ≤ 22 parole, t-md
│ cazione, con un editor che legge │
│ davvero il tuo testo.            │
│                                  │
│ [ Calcola il preventivo        ] │  primario rosso, 48 px
│ [ Analizza il manoscritto gratis] │  secondario bordo inchiostro, 48 px
│ Parla con un editor              │  link testuale blu
│ ─────────────────────────────────│  ← qui siamo a ~620 px
│ I diritti restano tuoi ·         │  tre rassicurazioni in riga, t-sm,
│ Prezzi chiari prima di iniziare ·│  senza spunte in bollino
│ La stima non chiede dati         │
│                                  │
│ [ illustrazione libro, ridotta ] │  sotto i pulsanti, max 220 px alta
├──────────────────────────────────┤
│ Da dove parti?                   │  H2 t-xl
│ ◄ [foglio] [foglio] [fog… ►      │  carosello scroll-snap, 5 fogli,
│      ● ○ ○ ○ ○                   │  indicatore di posizione
├──────────────────────────────────┤
│ La cura si vede                  │  H2
│ ┌──────────────────────────────┐ │
│ │ ORIGINALE  │  REVISIONATO    │ │  confronto: segni rossi/blu
│ │ testo con  │  testo con      │ │  sulle differenze
│ │ cancellat. │  inserimenti    │ │
│ └──────────────────────────────┘ │
│  ═══════════○══════════          │  slider da tastiera
├──────────────────────────────────┤
│ Come funziona                    │  H2
│ ① Raccontaci il progetto         │  timeline verticale su mobile,
│ ② Costruiamo il percorso         │  qui i numeri hanno senso
│ ③ Lavoriamo insieme              │
│ ④ Approvi ogni fase              │
│ ⑤ Ricevi il libro pronto         │
│ ┊ I diritti restano tuoi →       │  tre garanzie come note a margine
│ ┊ Prezzi chiari →                │
│ ┊ Approvi tu →                   │
├──────────────────────────────────┤
│▓▓ Il tuo spazio ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  fondo inchiostro
│▓▓ [ area autore, HTML reale ] ▓▓▓│  mockup HTML/SVG, in italiano, €
│▓▓ Dati di esempio ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  13,5 px
│▓▓ [ Prova l'area autore ] ▓▓▓▓▓▓▓│
├──────────────────────────────────┤
│ Servizi                          │  H2 — composto come un indice
│ Revisione                        │  parte
│   Correzione bozze ........ →    │  voce con puntini di guida
│   Editing stilistico ...... →    │
│ Scrittura                        │
│   Ghostwriting ............ →    │
│   …                              │
├──────────────────────────────────┤
│ Agenzie e publisher: white label,│  fascia sottile, una frase e un link
│ referente dedicato. Scopri →     │
├──────────────────────────────────┤
│ Quanto costa il tuo libro?       │  H2
│ Una riga.                        │
│ [ Calcola il preventivo        ] │
│ [ Analizza il manoscritto      ] │
├──────────────────────────────────┤
│ Colophon                         │  come il colophon di un libro:
│ Proemios è il marchio con cui    │  due righe su chi siamo,
│ Smart Content S.r.l.s. …         │  contatti, sede, P. IVA,
│ ciao@proemios.it · Grosseto      │  link legali,
│ P. IVA 01616260533               │  «Composto in Editorial e Interface»
│ Privacy  Termini  Cookie         │
│ Composto in Editorial e Interface│
└──────────────────────────────────┘
```

#### Home, 1280 px

```
┌────────────────────────────────────────────────────────────────────┐
│ [P] Proemios   Servizi  Percorsi  Come funziona  Per agenzie  Guide │
│                                   Area autori   [Calcola il preventivo]│
├────────────────────────────────────────────────────────────────────┤
│                                          │                         │
│  Dai forma alla ⁁ storia.                │   [ libro illustrato ]  │
│                (tua)                     │   senza striscia fasi,  │
│  Sottotitolo ≤ 22 parole.                │   senza pulsante pausa  │
│  [Calcola il preventivo] [Analizza…]     │                         │
│  Parla con un editor                     │                         │
│  I diritti restano tuoi · Prezzi chiari · La stima non chiede dati │
├────────────────────────────────────────────────────────────────────┤
│  Da dove parti?                                                     │
│  [foglio] [foglio] [foglio]                                         │
│  [foglio] [foglio]                        griglia 3 + 2             │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐   La cura si vede                     │
│  │ ORIGINALE │ REVISIONATO  │   Testo: cosa guarda un editor        │
│  │ segni di correzione      │   Il lavoro dietro ogni pagina →      │
│  └──────────────────────────┘                                       │
├────────────────────────────────────────────────────────────────────┤
│  Come funziona                                                      │
│  ①────②────③────④────⑤   timeline orizzontale, 5 passaggi           │
│  ┊ diritti →   ┊ costi →   ┊ approvazioni →   note a margine        │
├────────────────────────────────────────────────────────────────────┤
│▓ Il tuo spazio                  [ area autore HTML/SVG, nitida ]  ▓│
│▓ due righe + [Prova l'area autore]       Dati di esempio           ▓│
├────────────────────────────────────────────────────────────────────┤
│  Servizi                                                            │
│  Revisione                                 Scrittura                │
│    Correzione bozze ............... →        Ghostwriting ....... →  │
│    Editing stilistico ............. →        Co-writing ......... →  │
│  (indice a due colonne, per parte)                                  │
├────────────────────────────────────────────────────────────────────┤
│  Agenzie e publisher: white label, listino riservato. Scopri →      │  fascia
├────────────────────────────────────────────────────────────────────┤
│  Quanto costa il tuo libro?      [Calcola il preventivo] [Analizza…]│
├────────────────────────────────────────────────────────────────────┤
│  Colophon su tre colonne strette: chi siamo · contatti · legale     │
│  Composto in Editorial e Interface                                  │
└────────────────────────────────────────────────────────────────────┘
```

#### /preventivo, 375 px

```
┌──────────────────────────────────┐
│ [P] Proemios          Area autori ≡│
├──────────────────────────────────┤
│ Quanto costa il tuo libro?       │  H1
│ Sei domande, nessun dato         │  una riga
│ personale per la stima.          │
├──────────────────────────────────┤
│ ①Tipo ②Stato ③Dimens. ④Serv. ⑤… │  indicatore con i nomi, i passi
│ ──●──○──○──○──○──○               │  fatti sono cliccabili
│                                  │
│ Che libro è?                     │  domanda del passo
│ ○ Romanzo — narrativa, racconti  │  scelta singola: selezionare
│ ○ Saggio o manuale               │  porta avanti dopo 250 ms
│ ○ Memoir                         │
│ ○ Libro professionale            │
│ ○ Solo grafica                   │
│                                  │
│ ← Indietro                       │
│                                  │
│  …                               │
├──────────────────────────────────┤  ← barra fissa in basso
│ Essenziale 1 760 €  Consigliato  │  anteprima prezzi, si aggiorna
│ 2 260 €   ▲ dettagli             │  con transizione del numero
└──────────────────────────────────┘
```

#### /preventivo, 1280 px

```
┌────────────────────────────────────────────────────────────────────┐
│  Quanto costa il tuo libro?                                         │
│  ① Tipo ─── ② Stato ─── ③ Dimensione ─── ④ Servizi ─── ⑤ Tempi ─── ⑥ Contatto │
│                                                                     │
│  ┌─────────────────────────────────────┐  ┌──────────────────────┐ │
│  │ Che libro è?                        │  │ Anteprima            │ │
│  │ ○ Romanzo       ○ Saggio o manuale  │  │ Essenziale   1 760 € │ │  laterale,
│  │ ○ Memoir        ○ Libro profess.    │  │ Consigliato  2 260 € │ │  sticky
│  │ ○ Solo grafica                      │  │ Signature    3 810 € │ │
│  │                                     │  │ ~ 200 pagine         │ │
│  │ ← Indietro                          │  │ Si aggiorna mentre   │ │
│  └─────────────────────────────────────┘  │ rispondi.            │ │
│                                           └──────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### 4. Componenti

Tutto in `components/sito/` (nuova cartella, nome italiano come il resto del
progetto). Il vecchio `components/editorial/` e `app/editorial.css` vengono
rimossi quando l'ultima pagina li abbandona.

| Componente | Decisione |
|---|---|
| `Pulsante` | primario (rosso, testo bianco), secondario (bordo inchiostro), testuale (blu con sottolineatura a matita). Altezza min 48 px, padding 24 px. Freccia → solo se porta a un'altra pagina; mai ↗. |
| `Collegamento` | link testuale con area 44 × 44 su mobile e sottolineatura a matita al passaggio. |
| `Foglio` | l'unica card: bianco, `ombra-foglio`, `radius-foglio`, intero cliccabile con un solo link. Varianti per gerarchia, non per colore. |
| `Campo` | **riuso** di `components/ui/campi.tsx` (ha già label, aiuto, errore, `aria-describedby`, `aria-invalid`): cambiano solo le classi, che passano ai token nuovi. Aggiunta: `type`, `autocomplete`, `inputmode` corretti sui singoli campi, e un `RiepilogoErrori` focalizzato all'invio. |
| `Testata` | logo, 5 voci, «Area autori», pulsante primario. Hamburger sotto i 1 024 px, con focus trap ed Esc; il primario in fondo al menu, fisso. |
| `Colophon` | composto come il colophon di un libro. Niente griglia a 5 colonne. |
| `Sezione` | spazio verticale da token, filetto opzionale. |
| `Eyebrow` | **eliminata**. Dove un'etichetta orienta davvero, `Etichetta` in maiuscoletto grafite. |
| `Segni` | SVG a tratto di matita. |
| `Indice` | elenco servizi con puntini di guida, per parte. |
| `Confronto` | prima/dopo con segni di correzione e slider da tastiera (frecce, Home/End, `aria-valuenow/min/max`). |
| `Tappe` | timeline a 5 passaggi + note a margine. |
| `AreaAutoreDemo` | mockup in HTML/SVG reale, in italiano, importi in €. |
| `Carosello` | scroll-snap con indicatore e frecce da tastiera. |
| `FasciaDemo` | resta; rispetta `NEXT_PUBLIC_DEMO_MODE`. |

Da unificare: i tre pulsanti (`Bottone` legacy, `.button` editoriale, i link
«text-link»); le due card dei percorsi (`PathCards` editoriale e
`SchedaPercorso` legacy); i due set di servizi (`ServicesGrid` editoriale a 7
voci con chip non cliccabili e il catalogo legacy a 31 voci).

Fonte dei contenuti: `config/catalogo.ts` per i servizi (31, con tariffe) e
`config/percorsi.ts` per i percorsi (8, con tariffe). Sono la fonte di verità
dei prezzi e ogni voce ha già la sua pagina. I contenuti editoriali di
`lib/editorial-content.ts` restano serviti sui loro slug (nessun URL cambia),
ma non entrano più nella navigazione: due cataloghi paralleli in testata erano
una confusione per il lettore prima che per il codice.

### 5. Rilettura contro il brief — cosa ho cambiato nel piano, e perché

Ho riletto il piano cercando le scelte che farei per *qualsiasi* sito di
servizi. Queste le ho cambiate:

1. **Prima bozza: «Da dove parti» con 4 fogli** (i percorsi editoriali
   esistenti). Qualsiasi sito mostra «le sue 4 card». Cambiato: 5 punti di
   partenza presi dal catalogo con le tariffe — ho già scritto il libro, ho
   un'idea, voglio raccontare una storia vera, sono un professionista, ho i
   file pronti e voglio pubblicare. Gli altri tre percorsi del catalogo
   (ricerca storica, promozione, agenzie) restano in `/percorsi`; le agenzie
   hanno la loro fascia. Cinque è il numero di domande vere che un autore si
   fa, non un numero di griglia.
2. **Prima bozza: icone lineari (lucide) in cima a ogni foglio.** È la card da
   SaaS. Cambiato: illustrazione a tratto di matita, una per foglio, coerente
   con i segni di correzione. Niente icone di libreria sul sito pubblico.
3. **Prima bozza: tre rassicurazioni con spunta verde.** Cambiato: tre frasi in
   riga, separate da un filetto verticale, senza bollino. Una spunta verde è
   il segnale più generico del web.
4. **Prima bozza: la sezione «Il tuo spazio» con lo screenshot WebP esistente.**
   È sfocato a 2× e in inglese («Shipping Activity»). Cambiato: un mockup in
   HTML e SVG reale, con dati italiani e importi in €, che è anche più leggero.
5. **Prima bozza: `Etichetta` sopra ogni H2** (il vecchio eyebrow con un altro
   nome). Cambiato: nessuna etichetta sopra i titoli della home; l'H2 basta. Le
   etichette restano solo dove servono a orientare: le parti dell'indice dei
   servizi e i nomi dei passi del configuratore.
6. **Prima bozza: gradiente leggero sulle sezioni scure.** Cambiato: fondo
   inchiostro pieno. Un gradiente «leggero» è decorazione che non dice niente.
7. **Prima bozza: numerare i cinque fogli dei percorsi.** Cambiato: nessun
   numero. Non è una sequenza. I numeri restano solo sulla timeline, dove
   l'ordine è il contenuto.
8. **Prima bozza: freccia ↗ sui link testuali** (c'era dappertutto). Cambiato:
   → solo sui pulsanti che portano altrove; ↗ mai, perché significa «esterno».

Scelte tenute, con il motivo:

- Variante A (rosso e blu), non la B conservativa con il corallo: il brief la
  indica come primaria e il corallo è esattamente il tratto che rende il sito
  indistinguibile. Chi preferisce la B cambia due token.
- Il confronto prima/dopo sale al terzo posto nella home: è la prova del
  mestiere, e la tengono in alto perché è l'unica cosa che un concorrente non
  può mostrare senza avere un editor.

---

## Punti di logica trovati — da verificare, **non corretti**

> **Aggiornamento del 7 ottobre, sera.** Sul ramo base è stata unita la PR #13
> (6 ottobre), che corregge proprio il primo punto qui sotto: in
> `lib/pricing.ts` i servizi richiesti entrano ora in **tutti** i pacchetti,
> non solo nell'Essenziale, e un test fissa il caso del brief a
> 2 210 / 2 710 / 4 260 €. La correzione arriverà in questo ramo con il merge
> della base, che è in sospeso per una decisione descritta in «Fase D — Merge
> con la base». Le tabelle qui sotto descrivono il comportamento *prima* di
> quella correzione.

Il brief è chiaro: la grafica non tocca il calcolo dei prezzi. Questi punti
vanno guardati da chi decide il listino.

### Distanza fra Essenziale e Consigliato con la correzione bozze

Riprodotto con `computeQuote` di `lib/pricing.ts`, romanzo, stato «finito, da
revisionare», aggiungendo `proofreading` ai servizi richiesti:

| Parole | Essenziale | Essenziale + bozze | Consigliato | Distanza |
|---|---|---|---|---|
| 40 000 | 1 690 € | 2 090 € | 2 190 € | 100 € |
| 50 000 | 1 760 € | 2 210 € | 2 260 € | **50 €** (il caso del brief) |
| 55 000 | 1 855 € | 2 350 € | 2 355 € | **5 €** |
| 60 000 | 1 950 € | 2 490 € | 2 450 € | **−40 €**: l'Essenziale costa più del Consigliato |
| 80 000 | 2 454 € | 3 138 € | 2 954 € | **−184 €** |

Il meccanismo: i servizi richiesti si sommano all'Essenziale a tariffa piena,
mentre il Consigliato li include già nel pacchetto. Oltre le ~57 000 parole il
pacchetto «base» supera quello «consigliato». Non è un difetto di
presentazione: la grafica può solo mostrare i numeri che il motore dà. Serve
una decisione sul listino (per esempio: un servizio richiesto che il Consigliato
già include non dovrebbe mai portare l'Essenziale oltre il Consigliato).

### LCP

Vedi «Il motivo dell'LCP a 5 secondi» sopra: causa documentata, rimedio nel
passaggio «Token e fondamenta» (font) e «Home» (niente animazione sull'H1,
pagina statica).

### `NEXT_PUBLIC_DEMO_MODE`

Non esisteva. La fascia demo si accendeva da `demoAttiva()`, cioè
dall'assenza di `DATABASE_URL` o da `DEMO_MODE=on`, lato server. Aggiunta
`NEXT_PUBLIC_DEMO_MODE`: con `off` la fascia sparisce anche se la demo
server-side resta attiva. Non tocca la logica della demo (dati non salvati,
pagamenti simulati): governa solo la fascia.

---

## Fase C — Autocritica per passaggio

Compilata a ogni commit. Per ogni passaggio: cosa è cambiato, cosa ho tolto
perché non serviva, cosa non mi convince.

### C1 — Token e fondamenta

**Cosa è cambiato.** I token del sito pubblico stanno in `app/globals.css`
dentro `@theme`, con nomi diversi da quelli delle aree riservate
(`carta`/`inchiostro`/`grafite`/`rosso-matita`/`blu-matita`/`filetto`, sette
dimensioni `t-*`, tre raggi, due ombre). Tailwind ne genera le utility, quindi
`bg-carta` o `text-t-md` sono l'unico modo di scrivere un colore o una
dimensione in un componente pubblico. Il tema chiaro si accende con
`data-tema="carta"` sul contenitore del route group: il resto dell'app resta
scuro, e `body:has()` fa il cambio senza JavaScript. Focus: anello di 2 px in
blu matita con offset 2 px; carta dentro `data-tema="inchiostro"`.

Le cinque famiglie di font sono diventate due. Editorial e Interface passano
da OTF (110 KB l'uno, non precaricati) a woff2 (71 e 52 KB), dichiarate in
`globals.css` con facce di fallback che replicano le metriche del font vero
(`ascent-override`, `size-adjust`…), così il testo non si sposta quando il
woff2 arriva. Il layout radice precarica le due facce sopra la piega —
Editorial regolare e Interface regolare — con un `<link rel="preload">`
esplicito. Geist, Geist Mono e Instrument Serif sono uscite dal progetto:
`--font-sans`, `--font-serif` e `--font-mono` puntano alle due famiglie
locali, così le aree riservate e i componenti condivisi (configuratore,
moduli, catalogo) non cambiano codice. `--font-mono` non è più una monospace:
i numeri tabellari li danno `tabular-nums` nelle utility `cifre` ed
`etichetta`, che è ciò che serviva ai prezzi.

**Una cosa trovata strada facendo.** Avevo iniziato con `next/font/local`,
che è la via canonica. Ma con il layout radice dinamico — legge il nonce
della CSP da `headers()` — Next 15.5 non scrive i `<link rel="preload">` dei
font nell'HTML: li lascia come suggerimenti nel flusso RSC (`:HL[...]`), che
il browser vede solo dopo aver eseguito il runtime client. Un preload che
parte dopo il JavaScript non è un preload. Le metriche di fallback che
`next/font` aveva calcolato le ho riportate a mano nelle `@font-face`, e gli
URL stabili in `public/fonts/` hanno cache immutabile da `next.config.mjs`.

`NEXT_PUBLIC_DEMO_MODE` esiste e governa solo la fascia.

**Cosa ho tolto.** I quattro OTF e le tre famiglie Google. Nessun font nuovo.

**Cosa non mi convince ancora.** In questo passaggio il sito pubblico è
*identico* a prima, per scelta: i token nuovi esistono ma nessun componente
li usa ancora, e `editorial.css` continua a governare le pagine finché C2 e
C3 non lo sostituiscono. È il modo di tenere ogni commit verde. Il rovescio è
che per due commit convivono tre sistemi (scuro riservato, editoriale, matita):
la pulizia arriva quando l'ultima pagina abbandona `editorial.css`, non prima.

Verificato: TypeScript, ESLint, 438 test; build; nel browser caricano
esattamente quattro facce (Editorial 400 normale e corsivo, Interface 400 e
700) e nessuna richiesta a Google.

### C2 — Componenti condivisi

**Cosa è cambiato.** Nasce `components/sito/`: `Pulsante` e `PulsanteLink`
(primario rosso, secondario con bordo, testuale blu; 48 px, freccia → solo
verso un'altra pagina, mai ↗), `Collegamento` (sottolineatura a matita che si
traccia, 44 px di altezza cliccabile), `Foglio` (l'unica card, intera
cliccabile con un solo link), `Campo`/`Input`/`AreaTesto`/`Selezione`/
`Consenso`/`RiepilogoErrori` (stessa API dei campi delle aree riservate, token
della carta, errore con icona e testo, riepilogo focalizzato all'invio),
`Sezione`/`Contenitore`/`Etichetta`/`Intestazione`/`Filetto`, i cinque
`Segni` di correzione in SVG a tratto di matita, `Testata`, `Colophon` e
`GuscioSito`. `app/sito.css` tiene le poche regole che le utility non sanno
scrivere: maiuscoletto, sottolineatura a matita, tracciamento dei segni,
carosello con aggancio. Tutte sui token.

La testata ha cinque voci, «Area autori» e il pulsante primario; il menu a
scomparsa compare sotto i 1 024 px (prima: 1 050), copre tutto lo schermo
con la propria barra di chiusura, mette il primario in fondo e tiene il fuoco
dentro: Tab gira sulle sette voci e torna alla prima, Esc chiude e riporta il
fuoco sul pulsante che l'ha aperto. Il colophon è composto come il colophon
di un libro, con l'anagrafica da `config/legal.ts`, la nota vincolante
sull'AI e «Composto in Editorial e Interface».

**Tre difetti trovati provando, non leggendo.**

1. Il pulsante primario in testata aveva il testo *inchiostro* su rosso:
   3,02:1. `cn()` usa tailwind-merge, che non conosce la scala `text-t-*` e
   trattava `text-t-sm` come un colore, cancellando `text-bianco`. Il mobile,
   che non passa quella classe, era giusto: per questo axe lo segnalava solo
   a 1 280. Corretto dichiarando la scala a tailwind-merge in `lib/cn.ts`.
2. Il menu a scomparsa era alto cento pixel. `backdrop-filter` sulla testata
   la rende *containing block* dei discendenti `position: fixed`, quindi
   `bottom: 0` era il fondo della testata. Via il blur, menu a schermo intero.
3. Sopra la testata, scorrendo, compariva una banda nera: `editorial.css`
   dava al `body` `background: var(--background)`, una variabile definita solo
   su `.proemios-public`, quindi il body era trasparente e sotto c'era la
   tela scura di `:root { color-scheme: dark }`. Finché `.proemios-public`
   copriva tutta la pagina non si vedeva. Ora la tela la decide
   `html:has([data-tema="carta"])`.

**Cosa ho tolto.** L'eyebrow con il trattino (sostituita da un'`Etichetta` in
maiuscoletto, usata solo dove orienta), la freccia ↗ dai pulsanti, il blur
della testata, la griglia a cinque colonne del piè di pagina.

**Cosa non mi convince ancora.** Il corpo delle pagine è ancora quello
editoriale, dentro un involucro dichiarato *transitorio*: testata e colophon
nuovi sopra e sotto una pagina vecchia. È il prezzo di un commit per
passaggio. E la sottolineatura a matita è un gradiente CSS, non un tratto
disegnato: è onesto, leggero e rispetta `prefers-reduced-motion`, ma non ha
la grana del segno. Da rivedere se, a fine lavoro, i segni SVG reggono bene
e vale la pena allinearla.

### C3 — Home

**Cosa è cambiato.** La home è riscritta da zero su `components/sito`,
nell'ordine del wireframe: hero con il segno di inserimento, cinque fogli
«Da dove parti», il confronto prima/dopo, «Come funziona» con le tre garanzie
a margine, l'area autore su inchiostro, i servizi come indice, la fascia
delle agenzie, la chiusura. Nessuno scroll-reveal, nessuna animazione
sull'H1 o sull'immagine. Il confronto usa un `<input type="range">`: frecce,
Home ed End funzionano senza una riga di JavaScript in più, e le differenze
sono segnate come su una bozza — tratto rosso sulle parole tolte, blu con il
⁁ sotto per quelle aggiunte — con l'elenco delle correzioni in testo per chi
non vede il confronto. L'area autore è HTML e SVG: nitida, in italiano, con
gli importi che arrivano dal listino (`computeQuote`, romanzo da 50 000
parole: acconto 904 €, saldo 1 356 €), così «dati di esempio» è vero in
entrambi i sensi. L'indice dei servizi legge dal catalogo (31 voci, sei
parti; la settima, B2B, ha la fascia) e a destra mette la tariffa, non
«Scopri →»: in un indice la cosa a destra è un'informazione.

**Misure, stessa procedura del «prima».**

| | Prima | Dopo | Obiettivo |
|---|---|---|---|
| Altezza a 375 px | 11 727 | **8 871** | ≤ 9 000 |
| Testi < 13 px (375) | 85 | **0** | 0 |
| Target < 44 px (375) | 40 | **1** (il «Vai al contenuto», invisibile finché non ha il fuoco) | 0 |
| axe serious/critical, 4 larghezze | 4 | **0** | 0 |
| H1 | 1 | 1 | 1 |
| Pulsanti dell'hero dentro 375 × 667 | no | sì (il secondario finisce a 585 px) | sì |
| Lighthouse mobile — Performance | 52 | **92** | ≥ 95 |
| LCP | 5,3 s | **1,8 s** | < 2,0 s |
| FCP | 3,1 s | 1,8 s | < 1,2 s |
| TBT | 1 000 ms | 320 ms | — |
| Peso | 656 KiB | 416 KiB | < 400 KB |
| Accessibilità / Best practices | 100 / 100 | 100 / 100 | 100 / 100 |

I 16 test end-to-end su home, testata, accesso e prestazioni passano senza
modifiche: la testata nuova espone ciò che quei test cercavano.

**Cosa resta sopra il budget, e perché.** FCP e peso. Lighthouse conta 770 ms
di CSS bloccante: tre fogli, e uno è `editorial.css` da 3 086 righe che il
layout radice carica ancora su ogni pagina per le pagine non rifatte. Se ne va
in C5, e con lui la parte più grossa di quel tempo. I font trasferiti sono
175 KiB e sono le tre facce giuste — Editorial regolare, Interface regolare
e grassetto (il primario in testata) — verificato contando le richieste: il
corsivo non viene chiesto. Per scendere sotto i 400 KB resta da guardare il
JavaScript (138 KiB) in C6.

**Cosa ho tolto.** La striscia delle sei fasi e le schede di stato
sull'illustrazione dell'hero; dalla home, l'immagine della dashboard in
inglese (`dashboard.webp`) e quella del tavolo (`editor-desk.webp`) — i file
escono dal repository in C5, quando l'ultima pagina interna smette di usarli;
le tre spunte verdi; la numerazione 01–05 dei fogli; le testimonianze
segnaposto e l'«orbita» delle sei tappe — due sezioni intere, perché dicevano
quello che la timeline dice già; le chip non cliccabili dei servizi; il punto
mediano in «Amazon KDP · ISBN · Metadati».

**Cosa non mi convince ancora.** Le cinque illustrazioni a tratto sono
corrette ma timide: tre o quattro linee ciascuna, e a 64 px si somigliano. Se
a fine lavoro restano così, meglio toglierle e lasciare ai titoli il compito
di distinguere i fogli — un foglio bianco con un buon titolo serif regge da
solo. E il confronto a 375 px è stretto: due testi affiancati in 343 px si
leggono, ma la metà sinistra sotto il cursore è una colonna di tre parole.
Un'alternativa è mostrare, su mobile, prima l'originale intero e poi il
corretto, con il cursore solo da `md` in su. Da decidere guardandolo su un
telefono vero, non in uno screenshot.

### C4 — Flussi di conversione

**Cosa è cambiato.** Configuratore, risultato, flusso dell'analisi, report e
modulo di contatto sono riscritti nel markup e negli stili sui componenti di
`components/sito`; i blocchi di logica — stato, `computeQuote`, `calcola()`,
le chiamate alle API, consensi, honeypot, tracciamento — sono identici a
prima, riga per riga.

`/preventivo`: l'indicatore ha i nomi dei sei passi e i passi già fatti si
cliccano; una scelta singola (tipo, stato del testo, tempi) porta al passo
dopo da sola, 250 ms dopo, così si vede la scelta prima di cambiare schermo;
l'anteprima dei prezzi sta di lato da `lg` e in una barra fissa in basso sul
telefono, con il numero che si aggiorna con una breve transizione; «Calcola
il preventivo» non è mai disabilitato: se manca qualcosa, un riepilogo dice
cosa e il fuoco va al primo campo («Inserisci la tua email per ricevere il
preventivo»). Telefono con `type="tel"`, `inputmode="tel"`,
`autocomplete="tel"`. I prezzi arrivano da `Intl` in `it-IT`, con lo spazio
non separabile prima di €.

`/analisi-manoscritto`: l'area di caricamento ha gli stati vuoto,
trascinamento, file pronto (nome, peso, «Cambia file»), analisi in corso con
la barra, errore di formato o di peso con la soluzione nel messaggio. Prima
del pulsante: «Il tuo testo non viene archiviato». Il controllo di formato e
peso avviene subito, prima dell'invio — non è una validazione nuova lato
server, è un messaggio dato prima invece che dopo.

`/contatti`: stesso `Campo` ovunque, errori sul campo con `aria-describedby`
e `aria-invalid`, riepilogo focalizzato all'invio, conferma con lo stesso
verbo del pulsante: «Messaggio inviato. Ti rispondiamo entro un giorno
lavorativo».

**Verificato provando.** Nelle tre pagine, a 375 e 1 280: un H1, zero testi
sotto i 13 px, zero violazioni axe. Scelta singola → passo 2 dopo 400 ms;
click sull'indicatore → torna al passo 1; all'ultimo passo «Calcola» è
attivo e con i campi vuoti elenca tre cose da sistemare e porta il fuoco su
«Nome»; la barra in basso mostra «Consigliato 2 260 €» dopo due risposte;
un .txt da 21 KB diventa «File pronto», un .jpg produce «Il formato .jpg non
è tra quelli accettati…». I dieci test end-to-end del percorso cliente
passano.

**Cosa ho tolto.** Il pannello navy del configuratore (`.operative-surface`)
con dentro il tema scuro: le domande stanno sulla carta come il resto del
sito. Il «Passo 1 di 6» da solo, senza i nomi. L'asterisco: i campi dicono
«(obbligatorio)» o «(facoltativo)» in parole.

**Cosa non mi convince ancora.** La barra di avanzamento dell'analisi è
indeterminata: il server non comunica a che punto è, e una barra che finge
di saperlo sarebbe peggio. Si potrebbe passare a `XMLHttpRequest` per avere
l'avanzamento dell'*upload*, ma è il primo dei due tempi e il più breve: il
tempo lungo è la lettura del testo. L'ho lasciata onesta. E l'avanzamento
automatico dopo una scelta singola è una scelta del brief che va osservata
su utenti veri: a chi cambia idea costa un click in più su «Indietro».

### C5 — Pagine interne

**Cosa è cambiato.** Le tredici pagine interne — `/servizi`, `/servizi/[slug]`,
`/percorsi`, `/percorsi/[slug]`, `/come-funziona`, `/per-agenzie`, `/blog`,
`/blog/[slug]`, `/casi-studio`, `/casi-studio/[slug]`, `/chi-siamo`,
`/strumenti-ai`, `/preventivo/grazie` — più `/accedi` (con le sue due
sottopagine), le tre legali e il 404 stanno ora sugli stessi componenti di
`components/sito`: `Sezione`/`Contenitore`/`Intestazione`, `Foglio`,
`Pulsante`, `Collegamento`, `Campo`. I blocchi condivisi che le pagine
importavano (`components/marketing/*`, `components/sezioni/*`,
`components/moduli/*`, `components/auth/modulo-accesso`) sono riscritti nel
markup con la stessa firma, così nessuna pagina ha dovuto cambiare le chiamate
e la logica dei moduli — `fetch`, consensi, honeypot, `signIn` — è identica.

Il vecchio strato «editorial» è sparito del tutto: `components/editorial/`
(sette file), `app/editorial.css` (3 164 righe), `lib/editorial-utils.ts`,
`oggetto-editoriale.tsx` e due immagini di repertorio. Non c'è più nessuna
rete di sicurezza con i token legacy: una pagina pubblica che importasse
`ui/*` (l'area amministrativa) si vedrebbe subito, e il controllo è nel
riepilogo sotto. `lib/editorial-content.ts` resta come **dati**: i dieci slug
che esistevano solo lì (`/servizi/editing|pubblicazione|promozione`,
`/percorsi/libro-gia-scritto|idea-da-sviluppare|memoir|libro-professionale`,
tre guide in `/blog`) continuano a rispondere 200, resi da
`components/sito/contenuti-editoriali.tsx` con i componenti nuovi.

Scelte per pagina. `/servizi` è l'indice completo del catalogo (31 voci, con
la tariffa in riga invece di un «Scopri»): è lo stesso `IndiceServizi` della
home con `tutte`. `/percorsi/[slug]` mette i servizi del percorso con i
prezzi del catalogo, le tappe, le domande e «Non è il tuo caso?» con gli altri
percorsi. `/come-funziona` riusa `Tappe` della home. `/blog` unisce gli
articoli MDX pubblicati e le guide editoriali: gli MDX sono tutti
`pubblicato: false` per scelta della Fase 1 (sono outline di lavoro), quindi
oggi l'indice mostra tre guide — non è un bug, è il contenuto che c'è.
`/accedi` ha un layout proprio con `data-tema="carta"` e il logo, senza
testata né colophon: chi arriva lì vuole entrare, non navigare. Il 404 ha il
titolo con la cancellatura su «non c'è» e due uscite, home e preventivo.

**Verificato provando.** Tutte le rotte pubbliche e tutti gli URL della
sitemap rispondono 200 (33 rotte di controllo più la sitemap intera); le
pagine inesistenti danno 404. Audit sulle 15 pagine × 4 larghezze: 7 corpi
tipografici più il `clamp` del display (44/46,08/72 secondo la larghezza), 2
famiglie, 3 raggi, 2 ombre, 8 sfondi e 7 colori di testo — tutti token; zero
testi sotto i 13 px; zero violazioni axe serious/critical; un H1 per pagina.
I target sotto i 44 px che restano sono il link «Vai al contenuto» finché è
nascosto, l'honeypot, la casella del consenso (20 px, ma dentro una `label`
alta 44) e il link «privacy policy» in linea nel testo del consenso, che la
2.5.8 esclude esplicitamente. Nessuna pagina pubblica importa `ui/*`. I dieci
test end-to-end del percorso cliente passano.

Due errori trovati dall'audit e corretti prima del commit: `Foglio` con
`href` dentro un `<ul>` rendeva un `<a>` diretto figlio della lista
(`as="li"` veniva ignorato quando c'era il link) — ora il link sta dentro il
`<li>`; e l'indice delle guide era diviso per argomento con tre sezioni da una
carta l'una: ora è una griglia sola con l'argomento in maiuscoletto dentro la
carta.

**Cosa ho tolto.** Le tre intestazioni di raggruppamento di `/blog`. Il link
«Come funziona» dentro le garanzie quando sei già su `/come-funziona`
(`Tappe` ha `qui`). I puntini mediani rimasti nelle copy (`config/plans.ts`,
`config/case-studies.ts`, `area-autore`, termini, privacy, le code «· caso
dimostrativo» e «· in redazione»): virgole. Il colore lime del link «Vai al
contenuto», che era un token dell'area amministrativa: ora inchiostro su
carta, `text-t-sm`.

**Cosa non mi convince ancora.** `/servizi` a 375 px è un elenco lungo
(4 200 px) con la tariffa a fine riga: funziona come indice, ma sul telefono
il filetto puntinato fra nome e prezzo a volte è di tre caratteri. Un'ancora
per categoria in cima aiuterebbe chi cerca una voce precisa; rimandato a C6
se resta spazio. `DESIGN_PLAN.md`, `README.md` e `docs/DESIGN_SYSTEM.md`
citano ancora `components/editorial`: li aggiorno in C6 insieme al resto
della documentazione, in un commit a parte. I titoli delle schede usano
ancora « · » come separatore nel `<title>` (`lib/seo.tsx`): sono metadati,
che il brief chiede di mantenere, e non copy visibile; lo segnalo e non lo
tocco.

### C6 — Rifinitura

**Copy.** «Perimetro» non compare più fuori dalle condizioni di servizio
(domande di `/come-funziona`, principi di `/chi-siamo`, due testi in
`lib/editorial-content.ts`): «il lavoro concordato», «cosa serve davvero».
«White label» resta solo dove è il nome del prodotto nel catalogo
(`Produzione white label`, `B2B e white label`) e nelle due descrizioni SEO di
`/servizi` e `/percorsi` che lo elencano: rinominare un servizio è una scelta
commerciale, non di copy, e i metadati vanno mantenuti. Non c'era nessuno
«Scopri di più» da togliere. I puntini mediani erano già andati in C5.

**Accessibilità.** Gli anchor del nuovo indice delle parti in `/servizi` sono
alti e larghi almeno 44 px. L'audit sulle 15 pagine resta a zero violazioni
axe serious/critical e zero testi sotto i 13 px; i target sotto i 44 px sono
gli stessi quattro casi legittimi di C5. Il «Vai al contenuto» ora ha i colori
del sito anche nelle aree riservate: è nel layout radice ed è l'unico elemento
che le due identità condividono.

**Prestazioni.** Tre interventi, nell'ordine di resa:

1. *Font*: i quattro woff2 sono il sottoinsieme latino (380 codepoint, tutte
   le feature di layout) dei font interi, 111 KB invece di 255; il comando è
   nel commento sopra le `@font-face`. Le metriche dei fallback non cambiano.
2. *Immagine dell'hero*: aveva `priority` e `fetchpriority="high"`, ma sul
   telefono sta sotto la piega e l'LCP è il testo; adesso non compete con
   font e CSS per la banda.
3. *JavaScript*: lo slider del confronto e il carosello dei percorsi passano
   da `next/dynamic` (reso sul server, caricato a parte), come chiede il
   budget. Il primo caricamento della home è 136 KiB di script, di cui 103
   sono React e il runtime di Next condivisi da tutte le pagine: non c'è
   altro da togliere senza togliere l'interattività.

Misura sulla build di produzione, Lighthouse 13, mobile, `--preset=perf`:

| | Prima (Fase A) | C3 | **C6** simulato | **C6** throttling applicato |
|---|---|---|---|---|
| Performance | 52 | 92 | **97** | **98** |
| FCP | 3,1 s | 1,8 s | **1,1 s** | 1,8 s |
| LCP | 5,3 s | 1,8 s | 2,6 s | **1,8 s** |
| TBT | 1 000 ms | 320 ms | **50 ms** | 113 ms |
| CLS | — | 0 | **0** | **0** |
| Peso | 656 KiB | 416 KiB | **304 KiB** (32 HTML, 14 CSS, 136 JS, 79 font, 42 immagine) | — |
| TTFB (locale) | — | — | 30 ms | 27 ms |

Le due colonne C6 sono la stessa pagina misurata nei due modi di Lighthouse.
Con la simulazione (il metodo predefinito, quello di PageSpeed) l'LCP è a
2,6 s mentre l'FCP è a 1,1 s: l'elemento LCP è il paragrafo sotto l'H1, e
nella traccia osservata FCP e LCP coincidono a 183 ms; la differenza la fa il
modello, che per un LCP di testo mette nel grafo pessimistico tutto ciò che è
in rete prima dell'istante osservato, e con un server a 30 ms i chunk di
React sono già partiti. Con il throttling applicato al browser FCP e LCP
coincidono anche nella misura, a 1,8 s. Lo scrivo perché il budget dice
LCP < 2,0 s e con il metodo predefinito non ci sono: non è una scusa, è dove
sta il tempo. Per scendere sotto i 2 s anche simulati bisognerebbe rendere
le pagine di marketing statiche, e questo apre la decisione qui sotto.

**Pagine statiche: non fatto, e perché.** Il brief chiede che le pagine di
marketing siano statiche (`○`). Oggi sono tutte dinamiche (`ƒ`) per una
ragione sola: il layout radice legge `headers()` per prendere il nonce della
Content-Security-Policy, generato dal middleware a ogni richiesta, e Next
rende dinamica ogni pagina che lo fa. Renderle statiche vuol dire rinunciare
al nonce per richiesta sulle pagine pubbliche, cioè passare la CSP da
`'nonce-…' 'strict-dynamic'` a hash degli script o a `'unsafe-inline'`:
una scelta di sicurezza, non di design, che non prendo da solo. Le opzioni,
in ordine di preferenza: (a) tenere il nonce e accettare il rendering
dinamico — il TTFB locale è 30 ms e su Vercel dipende dal cold start della
funzione; (b) layout radice senza `headers()` e CSP a hash per le pagine di
`app/(sito)`, con il nonce solo nelle aree riservate; (c) `'unsafe-inline'`
sugli script delle pagine pubbliche. Chiedo quale.

**Icone e immagine sociale.** `app/icon.tsx`, `public/favicon.svg` e
`app/opengraph-image.tsx` usano carta, rosso matita, inchiostro e grafite al
posto di avorio e corallo; il simbolo resta quello.

**Documentazione.** `DESIGN_PLAN.md` è riscritto come mappa (dove stanno
token, font, componenti, guscio, contenuti) e rimanda a questo file;
`README.md` e `docs/DESIGN_SYSTEM.md` non citano più `components/editorial`
e dicono che il sito pubblico non usa i token delle aree riservate.

**Cosa ho tolto.** L'occhiello «Agenzie, publisher, partner» sopra l'H1 di
`/per-agenzie`: l'H1 dice già a chi parla. La `priority` sull'immagine
dell'hero.

**Tre correzioni emerse in Fase D, fatte qui.** (1) I fogli-link avevano un
`aria-label` con il solo titolo: il nome accessibile non conteneva il testo
visibile (WCAG 2.5.3, «etichetta nel nome») e Lighthouse lo segnalava sulla
home; `Foglio` non accetta più `aria-label`, il nome del link è tutto il
foglio. (2) Per le pagine dinamiche Next manda `<title>` e `<meta>` in
streaming dentro il `<body>` a ogni user agent che non sia nella sua lista di
bot «solo HTML» — Googlebot compreso, e Lighthouse 13, che non si presenta
più come «Chrome-Lighthouse». I browser e Google li leggono comunque, ma i
metadati del brief vanno «mantenuti», e mantenuti vuol dire nell'`<head>`:
`htmlLimitedBots: /./` in `next.config.mjs` li blocca lì per tutti. Qui i
metadati sono tutti sincroni, lo streaming non aveva niente da anticipare, e
il TTFB locale è rimasto a 30 ms. SEO da 92 a 100. (3) `images.imageSizes`
ha una taglia da 448 px: l'illustrazione dell'hero, mostrata a 220 px, a
densità 2 passava a 640 px; ora 24 KiB invece di 42.

**Cosa non mi convince ancora.** `/accedi` senza `DATABASE_URL` risponde 500
(è così anche prima del redesign: l'adapter di autenticazione si connette
all'avvio); nel deploy c'è sempre un database, ma un 500 su una pagina
pubblica andrebbe trasformato in una pagina che dice «accesso non
disponibile». Non l'ho toccato perché è logica di autenticazione. E la
decisione sulle pagine statiche sopra: finché non arriva, il budget LCP con
il metodo simulato resta a 2,6 s.

---

## Fase D — Verifica

Tutto misurato sulla build di produzione (`next start`), 7 ottobre 2026,
stessa procedura e stesso script del «prima» (`scripts/audit-design.mjs`,
`BASE=… FASE=after`). Screenshot, inventario, axe e i rapporti Lighthouse
sono in `design-audit/after/`; `design-audit/confronto.html` affianca prima e
dopo per le 15 pagine a 375 e 1 280 px.

### Prima / dopo

| | Prima (deploy del 7 ottobre) | Dopo | Obiettivo |
|---|---|---|---|
| Corpi tipografici distinti (15 pagine × 4 larghezze) | 71 | **7** + il `clamp` del display | 7 |
| Famiglie di font | 5 | **2** | 2 |
| Raggi distinti | 19 | **3** | 3 |
| Ombre distinte | 11 | **2** | 2 |
| Colori di sfondo distinti | 41 | **8** | — |
| Colori di testo distinti | 31 | **7** | — |
| Altezza della home a 375 px | 11 727 px | **8 906 px** | ≤ 9 000 |
| Testi sotto i 13 px (home, 375) | 85 | **0** | 0 |
| Target sotto i 44 px (home, 375) | 40 | **1** (il «Vai al contenuto» finché è nascosto) | 0 |
| axe serious/critical, 15 pagine × 375 e 1 280 | 4 | **0** | 0 |
| Lighthouse home mobile — Perf / A11y / BP / SEO | 52 / 100 / 100 / 58 | **97 / 100 / 100 / 100** | ≥ 95 / 100 / 100 / 100 |
| Lighthouse /preventivo mobile | 95 / 98 / 100 / 54 | **96 / 100 / 100 / 100** | idem |
| FCP home | 3,1 s | **1,1 s** | < 1,2 s |
| LCP home (simulato / throttling applicato) | 5,3 s | 2,6 s / **1,8 s** | < 2,0 s |
| TBT home | 1 000 ms | **48 ms** | — |
| CLS home | 0,023 | **0** | < 0,05 |
| Peso della home | 656 KiB | **285 KiB** (30 HTML, 14 CSS, 136 JS, 79 font, 24 immagine) | < 400 KB |
| Peso di /preventivo | 589 KiB | **253 KiB** | — |
| TTFB (locale) | — | 16–37 ms | < 300 ms |

I target sotto i 44 px che restano sulle altre pagine sono i quattro casi di
C5 (link di salto nascosto, honeypot, casella del consenso dentro una `label`
da 44 px, link in linea nel testo del consenso).

### Criteri di accettazione del brief

- **Nessun colore, raggio, ombra o corpo letterale fuori dai token.** `rg`
  su `app/(sito)`, `app/accedi`, `app/not-found.tsx`, `app/sito.css` e i
  componenti del sito per `#hex`, `rgb(`, `text-[`, `rounded-[`, `shadow-[`,
  `font-size:`, `border-radius:`, `box-shadow:`: l'unico risultato era un
  `text-[0.9em]` nella pagina dei cookie, corretto. Restano `max-w-[220px]`
  e `min-h-[20rem]`, che sono misure, non token del brief. L'inventario
  calcolato a runtime conferma: 7 corpi, 3 raggi, 2 ombre.
- **axe: 0 serious/critical** su 15 pagine × 2 larghezze.
- **Lighthouse ≥ 95 / 100 / 100 / 100** su home e /preventivo: sì (97 e 96).
  LCP simulato 2,6 s contro il budget di 2,0 s: spiegato in C6, dipende dal
  rendering dinamico e dal modello di Lighthouse; con throttling applicato è
  1,8 s.
- **Test di fumo Playwright** (`e2e/sito.spec.ts`, 5 test): configuratore
  fino al sesto passo con le sole scelte e ritorno dall'indicatore;
  caricamento fino a «File pronto» e rifiuto di un `.jpg` prima dell'invio;
  menu mobile aperto, percorso con Tab senza uscirne, chiuso con Esc e fuoco
  restituito; cursore del confronto con frecce, Home, End e `aria-valuetext`.
  Con i 33 test esistenti: **38 passati**. Unitari: 438 passati.
- **Crawl**: 67 pagine raggiunte dalla home seguendo ogni link interno
  (compresi i `/preventivo?tipo=…`), **nessun non-200**; 60 link esterni non
  seguiti. Le 33 rotte di controllo e tutti gli URL della sitemap rispondono
  200; gli otto redirect storici restano 301.
- **Screenshot «dopo»** in `design-audit/after/`, 15 pagine × 4 larghezze.

### Cosa non ho fatto, e perché

1. **Pagine di marketing statiche.** Richiede di togliere il nonce della CSP
   dal layout radice: decisione di sicurezza, con tre opzioni elencate in C6.
   Finché resta dinamico, l'LCP simulato sta a 2,6 s e il `bf-cache` è
   spento (`Cache-Control: no-store` sulle pagine dinamiche).
2. **La logica dei prezzi** (Essenziale + correzione bozze che supera il
   Consigliato da 60 000 parole in su): documentata in «Punti di logica», non
   toccata.
3. **Consolidare catalogo e contenuti editoriali** (`/servizi/editing` e
   simili): scelta commerciale, lasciata aperta e segnalata.
4. **`/accedi` senza database → 500**: logica di autenticazione, segnalata.
5. **Rinominare «white label»** nel nome dei servizi: è il prodotto.
6. **Schede del team e testimonianze**: non esistono contenuti verificati; il
   sito dice che arriveranno, non li finge.

### Merge con la base (PR #13)

Dopo la verifica ho trovato la base spostata di otto commit (PR #13,
«Rinnova homepage, libro interattivo e anteprima area autore», unita il 6
ottobre): un libro 3D animato nell'hero, un brief vocale con dettatura e un
assistente che precompila il configuratore, una demo dell'area autore in
`/area-autore` con login simulato in `localStorage`, 4 000 righe di CSS
proprie, e alcune correzioni di comportamento. Settanta file, 38 conflitti.

La linea, confermata dal fondatore: **la presentazione nuova vince, il
comportamento della base vince.** Portato dentro e ridisegnato sui componenti
del sito:

- i servizi richiesti in tutti i pacchetti (`lib/pricing.ts`, con il test
  che fissa il caso del brief a 2 210 / 2 710 / 4 260 €): il punto di logica
  segnalato in Fase B è chiuso dalla base;
- il brief vocale (`components/preventivo/voice-brief.tsx`, logica di
  `lib/quote-assistant.ts` e `components/voice/use-dictation.ts` identica):
  sta sopra la prima domanda del configuratore, su carta-ombra, con un solo
  pulsante «Detta il progetto» e le informazioni riconosciute come pillole;
- i parametri `stato`, `tempi` e `servizi` di `/preventivo`, l'honeypot del
  configuratore, il flag «preventivo dimostrativo» nel risultato;
- `motivo` e `quote` in `/contatti` (messaggio precompilato da «Parla con un
  editor» e riferimento al preventivo), le conferme «Invio simulato» nei due
  moduli quando l'API risponde in demo;
- il limite dei file a 4 MB (`lib/extract.ts`, copy, API) con il 413 e la
  risposta non JSON gestiti nel flusso dell'analisi;
- `noindex` anche in anteprima Vercel, sitemap vuota quando l'indicizzazione
  è bloccata, `lastmod` fisso, JSON-LD con `<` escapato, attribution spenta
  in demo, `/preventivo/grazie` nel `Disallow`;
- la verifica Stripe nella pagina «grazie»: «La data è tua» solo se la
  sessione risulta pagata, altrimenti «Stiamo verificando il pagamento» con
  la via d'uscita;
- il monogramma «P» (`lib/brand-mark.ts`), che il brief chiede di tenere, su
  logo, icona e favicon: corpo nel colore del testo, occhio della P a foro,
  angolo ripiegato in rosso matita.

Non portato dentro, per scelta del fondatore: il libro 3D con le sue scene,
le 4 000 righe di CSS di #13, la demo `/area-autore` con il login simulato
(questa PR ha l'area autore vera in `/area`; «Prova l'area autore» porta a
`/accedi`), i due font `sans*.woff2` duplicati. `lib/author-demo.ts` e i
suoi test vanno via con la demo; restano i test dell'assistente e dei
pacchetti. Due test end-to-end avevano bisogno di un selettore più preciso:
il pulsante del microfono è un toggle con `aria-pressed`, come le opzioni.

Dopo il merge: tsc, lint e build puliti; 444 unitari; 38 e2e; 15 pagine
con zero violazioni axe e 7 corpi / 3 raggi / 2 ombre; 67 pagine
raggiunte dalla home senza un non-200; Lighthouse home 94–97 / 100 / 100 /
100 e /preventivo 98 / 100 / 100 / 100 (la simulazione oscilla di qualche
punto fra una corsa e l'altra; FCP, CLS e peso non cambiano: 1,1–1,2 s, 0,
285 KiB).
