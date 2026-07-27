# Rotasjonsstøtte og Tavle-design — Endringslogg

**Dato:** 2026-03-08  
**Status:** Fullført  
**Scope:** Rotasjons-bugfikser i alle visninger + redesign av tavle-dekorasjon

---

## Bakgrunn

To separate problemer ble løst i denne sesjonen:

1. **Tavle-SVG skalerte dårlig** — det forrige whiteboard-SVG brukte `<text>`-elementer med fast `font-size` inne i `preserveAspectRatio="none"`. Ved resizing ble teksten uskarp og feil proporsjonal.
2. **Rotasjonsbugs i alle visninger** — søppelbøtte viste seg opp-ned, "TAVLE"-tekst på whiteboard-dekorasjonen viste seg opp-ned, og "TAVLE"-brettet fulgte ikke rommets `designMode` korrekt.

---

## Endringer

### 1. Tavle-dekorasjon redesignet (`src/shared/decoSvg.js`, `src/styles/room-editor.css`)

**Problem:** SVG for `whiteboard`-dekorasjonen brukte `<text font-size="22">TAVLE</text>` inni en SVG med `preserveAspectRatio="none"`. SVG-tekst skalerer ikke med elementstørrelsen — resultatet ble stygt og uleselig ved resize.

**Løsning:** Fjernet `<text>`-elementet fra SVG og erstattet det med en `<span class="deco-whiteboard-label">TAVLE</span>` som er et søskenelement til SVG-en (begge satt inn via `innerHTML`). CSS posisjonerer spannet absolutt over SVG-en med `position: absolute; display: flex; align-items: center; justify-content: center` — HTML-tekst som skalerer korrekt uavhengig av elementstørrelse.

SVG-en ble redesignet til å vise kun strukturelle elementer:
- Rektangulær bordflate med indigo-kant
- Bunn-rail (tray/eraser-list) som et mørkere rektangel
- To sirkulære monteringsdetaljer på railen

**Filer endret:**
- `src/shared/decoSvg.js` — whiteboard case
- `src/styles/room-editor.css` — `.decoration-whiteboard`, `.deco-whiteboard-label`

---

### 2. Rotasjonsbugs — fullstendig fix

Alle fire bugs identifisert i analysen ble løst.

#### Bug 1 — TAVLE-tekst opp-ned ved rotasjon (`src/views/seating-editor.js`, `src/views/presentation.js`)

**Årsak:** `renderDecorations()` setter `el.style.transform = 'rotate(180deg)'` på hele dekorasjons-div-en ved `flipForDisplay`. `.deco-whiteboard-label`-spannet arver denne rotasjonen uten noen counter-rotation.

**Fix:** Etter at `innerHTML` er satt for whiteboard-type, legges counter-rotation direkte på label-spannet:
```js
if (deco.type === 'whiteboard') {
  const label = el.querySelector('.deco-whiteboard-label');
  if (label) label.style.transform = `rotate(${-rot}deg)`;
}
```
Gjelder i begge `renderDecorations()`-funksjoner (seating-editor og presentation).

#### Bug 2 — Søppelbøtte (og andre dekorasjoner) opp-ned (`src/views/seating-editor.js`, `src/views/presentation.js`)

**Årsak:** `renderDecorations()` roterte ALLE dekorasjoner +180° ved `flipForDisplay`, inkludert dekorasjoner som trashcan, sink, screen, bookshelf og whiteboard — som har en klar "riktig side opp"-orientering og ikke gir mening å flippe.

**Fix:** Ny `UPRIGHT_ONLY_DECOS`-konstant:
```js
const UPRIGHT_ONLY_DECOS = new Set(['trashcan', 'sink', 'screen', 'whiteboard', 'bookshelf']);
```
Disse dekorasjonene hoppes over i `rot + 180`-beregningen. Posisjon speilvendes fortsatt korrekt (riktig hjørne av canvas).

#### Bug 3 — Front-board fulgte ikke `designMode` (`src/views/seating-editor.js`)

**Årsak:** `#front-board` i `seating-editor.html` er statisk satt til `class="front-board board-top"`. `_chart.roomDesignMode` (board-top/board-bottom) ble aldri brukt til å posisjonere front-board i seating-editoren.

**Fix:** I `render()` legges XOR-logikk til:
```js
const fb = document.getElementById('front-board');
if (fb) {
  const isBottom = (_chart.roomDesignMode === 'board-bottom') !== !!_chart.flipForDisplay;
  fb.classList.toggle('board-top', !isBottom);
  fb.classList.toggle('board-bottom', isBottom);
}
```
XOR (`!==`) sikrer at `board-bottom` + rotert = visuelt øverst (riktig), og `board-top` + rotert = visuelt nederst.

#### Bug 4 — "TAVLE"-tekst på front-board opp-ned i romdesigneren (`src/styles/canvas.css`, `src/styles/room-editor.css`)

**Årsak:** `.front-board` roterte med canvas-en. Eksisterende regel i `room-editor.css` hadde en feilaktig kommentar ("no counter-rotation needed") og satte kun `translateX(-50%)` uten counter-rotation.

**Fix:** Counter-rotation lagt til i `canvas.css` (gjelder globalt for alle canvas-typer):
```css
.canvas-rotated .front-board {
  transform: translateX(-50%) rotate(-180deg);
}
```
Kommentar i `room-editor.css` oppdatert og regelen justert til å også inkludere `rotate(-180deg)`.

---

## Filer endret

| Fil | Endringer |
|---|---|
| `src/shared/decoSvg.js` | Whiteboard: fjernet SVG-tekst, lagt til strukturelle SVG-elementer + `<span>` |
| `src/styles/room-editor.css` | `.decoration-whiteboard`, `.deco-whiteboard-label` CSS; `room-canvas.canvas-rotated .front-board` korrigert |
| `src/views/seating-editor.js` | `UPRIGHT_ONLY_DECOS`, whiteboard counter-rotation, front-board XOR-posisjonering |
| `src/views/presentation.js` | `UPRIGHT_ONLY_DECOS`, whiteboard counter-rotation |
| `src/styles/canvas.css` | `.canvas-rotated .front-board` counter-rotation |

---

## Teknisk arkitektur — rotasjonssystem

```
flipForDisplay = true
  │
  ├─ CSS: canvas-rotated → rotate(180deg) på canvas-elementet
  │    └─ CSS counter-rotation:
  │         .student-name, .desk-number, .desk-slot, .room-desk > span → rotate(-180deg)
  │         .front-board → translateX(-50%) rotate(-180deg)
  │
  └─ JS: renderDecorations()
       ├─ Posisjoner speilvendes: x = CANVAS_W - x - width, y = roomHeight - y - height
       ├─ UPRIGHT_ONLY_DECOS: trashcan, sink, screen, whiteboard, bookshelf
       │    └─ Roteres IKKE +180° (de forblir "riktig side opp")
       ├─ Øvrige dekorasjoner (door, wall, window, cabinet, label):
       │    └─ rot = (rot + 180) % 360
       └─ Whiteboard spesialtilfelle:
            └─ label.style.transform = rotate(-rot deg)  [counter-roterer teksten tilbake]
```
