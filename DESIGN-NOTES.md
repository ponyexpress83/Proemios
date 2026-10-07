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

_(da compilare)_

### C2 — Componenti condivisi

_(da compilare)_

### C3 — Home

_(da compilare)_

### C4 — Flussi di conversione

_(da compilare)_

### C5 — Pagine interne

_(da compilare)_

### C6 — Rifinitura

_(da compilare)_

---

## Fase D — Verifica

_(da compilare: metriche prima/dopo, axe, Lighthouse, test di fumo, crawl)_
