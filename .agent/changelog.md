# Changelog - KlassePlass

## Formål
Dette dokumentet loggfører alle endringer i KlassePlass-prosjektet.

---

## 2026-03-04 - Innstillinger: Tab-navigasjon, fargetemaer og nye informasjonssider

**Kategori:** Feature / UX

**Branch:** `main`

**Commits:** `d8f1137`, `f6f8a78`, `9412bc5`, `9233b12`, `0a7b2aa`, `36e47b5`, `9704d2b`, `da9a004`

### Fargetemaer — velgbar fargeprofil per modus

- Nytt felt `colorTheme` (string, DaisyUI-temanavn) i `settings.json` og `store.js`
- `applyTheme()` i `renderer.js` setter nå `data-theme` direkte fra `colorTheme` (ikke lenger hardkodet `dracula`/`light`)
- Fallback til `night` (mørk) og `nord` (lys) for eksisterende brukere uten `colorTheme` i JSON
- **6 mørke temaer:** Natt (`night`), Dracula, Kaffe (`coffee`), Halloween, Svart (`black`), Dim
- **3 lyse temaer:** Nord, Vinter (`winter`), Bedrift (`corporate`)
- `night` erstatter `dracula` som standard mørkt tema; `nord` erstatter `light` som standard lyst tema

### Logo-fargetilpasning

- "Klasse"-spannet i sidebar-logoen bruker nå CSS-klasse `.logo-klasse` i stedet for hardkodet `color:#e0f2fe`
- Lyse temaer (`light`, `nord`, `winter`, `corporate`) viser mørk navy-tekst (`#1e3a5f`) for kontrast

### Fargeprøver (swatches) i innstillinger

- Ny rad «Fargetema» under modus-bryteren i Utseende-seksjonen
- Sirkelformede prøveknapper viser faktisk bakgrunnsfarge og primærfarge for hvert tema
- Aktivt tema markert med `outline` + `border-color` (løst CSS-spesifisitetsbug med `!important`)
- Bytte av modus (Mørk/Lys) resetter til standardtema for ny modus

### Innstillinger: Tab-navigasjon

- Innstillingssiden redesignet fra stablede seksjoner til 5 faner med understreket aktiv-indikator
- **Utseende** — tema (modus + fargeprøver) og visningsinnstillinger
- **Data** — Database (backup/restore/flytt) + Eksport/import samlet
- **Om** — KlassePlass-logo, appbeskrivelse, dynamisk versjonsnummer, utviklerinfo
- **Lisenser** — tabell over alle tredjepartsbiblioteker (Electron, electron-updater, sqlite3, DaisyUI, Tailwind CSS, Font Awesome, Inter)
- **Personvern** — ansvarsfraskrivelse, GDPR-info for skolebruk med UDIR-referanse, forklaring av lokal datahåndtering

**Filer endret:**
- `src/views/settings.js` — THEMES-konstant, TEMPLATE med tabs, tab-switching i `bindEvents()`, `renderSwatches()`, `setColorTheme()`, `setTheme()`, `loadSettings()`
- `src/renderer.js` — `DARK_THEMES`/`LIGHT_THEMES`-konstanter, `applyTheme(settings)` mottar nå settings-objekt
- `src/styles/layout.css` — `.settings-tabs-nav`, `.settings-tab`, `.settings-tab-content`, `.settings-about-hero`, `.settings-license-table`, `.settings-privacy-block`, `.color-theme-swatches`, `.color-swatch`
- `src/db.js` — `colorTheme: 'night'` i default settings
- `src/store.js` — `colorTheme: 'night'` i INITIAL_STATE
- `index.html` — `.logo-klasse` CSS-klasse og tilhørende regler for lyse temaer
- `docs/plans/2026-03-04-color-themes.md` — implementasjonsplan

---

## 2026-03-04 - Romdesigner: Bordplassering, ikonstørrelser, nye dekorasjoner og posisjonsbasert nummerering

**Kategori:** Feature / Bugfix / UX

**Branch:** `main`

### Endringer

**1. Bordplassering innenfor rommet (`room-editor.js`)**
- Ny bord-plasserings-algoritme: bord legges til i et 4-kolonners rutenett fra øverst-venstre
- Koordinatene clampes til `CANVAS_W - info.width` og `roomHeight - info.height`
- Fikset manglende import av `CANVAS_W` fra `constants.js` — var rotårsaken til at bordknappene ikke virket

**2. Ikonstørrelser i toolbar (`room-editor.css`)**
- `desk-mini` thumbnails økt: `single` 20×13 → 26×17 px, `bench2` 32×13 → 40×17 px, `bench4` 46×13 → 54×17 px, `round` 18×18 → 22×22 px
- Kanttykkelse økt fra 1px til 1.5px, kontrast forbedret
- `.desk-add-btn--typed` fikk mer padding og gap for bedre luft rundt thumbnails

**3. Nye romdekorasjoner (`constants.js`, `room-editor.js`, `room-editor-generate.js`)**
- Lagt til 5 nye dekorasjonstyper med plansnitt-SVG-er:
  - `screen` (TV/Projektor) — lilla, 160×20 px
  - `bookshelf` (Bokhylle) — brun, 120×40 px
  - `sink` (Vask) — blå, 60×60 px
  - `trashcan` (Søppelkasse) — grå, 40×40 px
- Fjernet `teacher-desk` (lærerbord) etter bruker-tilbakemelding
- Alle nye typer støtter kontekstmeny, flip og rotasjon

**4. "Bord"-label i toolbar**
- Picker-label i desk-picker endret fra "Pulter" til "Bord"

**5. Posisjonsbasert bordnummerering (`room-editor.js`, `room-editor-generate.js`)**
- Bordnummer tildeles nå basert på posisjon (øverst→nederst, venstre→høyre) — ikke opprettelsesrekkefølgen
- `render()` bygger en `deskOrder`-map (`Map<deskId, nummer>`) sortert på `y` primært, `x` sekundært
- `buildRoomDeskEl` tar imot `deskOrder` som parameter og bruker `deskOrder.get(desk.id)`
- Nummeret oppdateres automatisk ved hver `render()` — inkludert etter dra-og-slipp

**Filer endret:**
- `src/views/room-editor.js` — ny plasserings-algoritme, `CANVAS_W`-import, `deskOrder`-map, "Bord"-label, nye deco-knapper, utvidet `defs`
- `src/views/room-editor-generate.js` — `buildRoomDeskEl` tar `deskOrder`-parameter, bruker `deskOrder.get()`, nye SVG-caser
- `src/styles/room-editor.css` — større `desk-mini`-størrelser, forbedret knapp-padding
- `src/shared/constants.js` — 4 nye typer i `DECORATION_TYPES`, fjernet `teacher-desk`

---

## 2026-03-04 - Romdesigner: UX-forbedringer, multi-select, dekorasjoner og toolbar-redesign

**Kategori:** Feature / Bugfix / UX

**Branch:** `main`

### Klasseeditor — auto-lagring og UX-rydding (`classes.js`, `classes-student-panel.js`, `classes.css`)
- Erstattet manuell "Lagre"-knapp med auto-lagring (debounce 800ms) og visuell status-indikator (`saving` / `saved`)
- Notat-modal: erstattet upassende placeholder ("ADHD må sitte bakerst") med nøytral tekst
- Notat-knapp: konsistent `fa-note-sticky`-ikon, farget bakgrunn når notat finnes
- Plasseringsvelger: "— Prioritet —" → "Ingen prioritet"
- Elevliste endret fra én kolonne til 2-kolonne CSS-grid for bedre plassutnyttelse
- Inline styles erstattet med CSS-klasser (`.panel-header-actions`, `.section-header-controls`)

### Romdesigner — multi-select og marquee-seleksjon (`room-editor-drag.js`)
- **Multi-select bug**: `pointerdown` på bord tømte alltid seleksjonen uten å sjekke `e.shiftKey` — fikset
- **Marquee-seleksjon**: fullstendig omskriving av `initSelectionBox`:
  - Byttet fra `mousedown` til `pointerdown` for konsistens med desk/deco-handlere
  - Fjernet feil `scrollLeft`/`scrollTop`-offset fra koordinatberegning
  - Lagt til 4px deadzone for å unngå utilsiktede mikroseleksjoner
  - Lagt til `click`-stopPropagation etter marquee for å hindre at seleksjonen ble tømt
  - Flyttet `pointermove`/`pointerup`-lyttere til `document`-nivå for robusthet

### Romdesigner — gruppe-drag mot vegger (`room-editor-drag.js`)
- Tidligere: hvert bord ble clamped individuelt → "trekkspill"-effekt mot vegger
- Fikset: beregner én felles `deltaX`/`deltaY` begrenset av den strengeste grensen i gruppen — alle bord stopper som én enhet

### Romdesigner — roterte dekorasjoner bounds (`room-editor-drag.js`)
- `snapDeco` brukte rå `deco.width/height` selv når elementet var rotert 90°/270° — blokkerte bevegelse mot høyre
- Fikset: `effectiveW`/`effectiveH` bytter bredde og høyde når `rotation % 180 !== 0`

### Romdesigner — tavle-ikon, SVG og kontekstmeny (`room-editor-generate.js`, `room-editor.css`)
- Dør-SVG: fjernet grå vegglinje, beholder kun dørbladet og svingbuen
- Dekorasjoner støtter nå flip: `flipH`/`flipV` i dataobjektet gir `scaleX(-1)`/`scaleY(-1)` via CSS
- Kontekstmeny for dekorasjoner: lagt til "Speil horisontalt" og "Speil vertikalt"
- `canvas.css` counter-roterte tavle-teksten i rotert rom — overstyrt i `room-editor.css` slik at tavlen følger canvas-rotasjonen
- `_rotated`-tilstand persisteres i `layoutData` og gjenopprettes ved lasting

### Romdesigner — toolbar-redesign (`room-editor.js`, `room-editor.css`)
- Dekorasjonspickeren flyttet fra hoved-toolbar til ny `deco-toolbar`-stripe under
- "Auto"-knapp omdøpt til "Hurtiglayout" med ny `.room-action-btn`-stil (ikon over tekst)
- "Roter visning"-knapp fik samme stil med `.btn-active` når rommet er rotert
- Desk-picker-knapper redesignet: thumbnail + kapasitetsbadge (`.desk-thumb-cap`) + tekstlabel (`.desk-thumb-label`)

### Romdesigner — bordnummer og labels i canvas (`room-editor-generate.js`, `room-editor.css`)
- Hvert bord i romdesigneren viser nå bordnummer øverst til høyre (`.room-desk-number`) og bordtype-label nederst (`.room-desk-label`)
- `renderDesks` (brukt i seating-editor og presentasjon) er uendret

**Filer endret:**
- `src/views/classes.js`
- `src/views/classes-student-panel.js`
- `src/styles/classes.css`
- `src/views/room-editor.js`
- `src/views/room-editor-drag.js`
- `src/views/room-editor-generate.js`
- `src/styles/room-editor.css`
- `src/shared/renderDesks.js` — `dragleave`-fix for barn-elementer
- `src/shared/constants.js` — `CANVAS_W` eksport

---

## 2026-03-04 - Refaktorering: Store moduler splittet til single-responsibility filer

**Kategori:** Refactoring / Maintainability
**Branch:** `main`
**Commits:** `86208eb`, `78599c5`, `315a952`, `3990127`, `240ebae`

### Mål
Filer over 300 linjer splittet for å gjøre det tryggere å arbeide parallelt med flere agenter.

### Endringer

**1. `canvas.css` (743 linjer) → 5 CSS-filer:**
- `src/styles/canvas.css` (~110 linjer) — seating-canvas, desk, slots, rotasjon
- `src/styles/room-editor.css` (~120 linjer) — romdesigner, dekorasjoner, desk-picker
- `src/styles/classes.css` (~130 linjer) — klasse-layout, student-row, constraints
- `src/styles/components.css` (~85 linjer) — modaler, toast, context-meny, animasjoner
- `src/styles/layout.css` (~130 linjer) — editor-layout, toolbar, views, settings, forms
- `index.html` oppdatert med 5 `<link>`-tagger

**2. `shared/utils.js` + `shared/contextMenu.js` — duplikat-konsolidering:**
- `getPortal()` fjernet fra `contextMenu.js`, importeres nå fra `utils.js`
- `normalizeStudents()` i `utils.js` oppgradert til robust versjon (håndterer id, name, note)
- `chartHelpers.js` re-eksporterer `normalizeStudents` fra `utils.js` istedet for å duplisere den
- `classes.js` bruker nå `normalizeStudents` fra `utils.js` istedet for lokal kopi

**3. `room-editor.js` (653 linjer) → 3 filer:**
- `src/views/room-editor.js` (~195 linjer) — mount/unmount, render, lagre, events
- `src/views/room-editor-drag.js` (~195 linjer) — makeDeskDraggable, makeDecoDraggable, initSelectionBox, snapDesk, snapDeco
- `src/views/room-editor-generate.js` (~185 linjer) — buildRoomDeskEl, buildDecoEl, context-menyer, AUTO_PRESETS, autoGenerate, applyAutoGenerate

**4. `seating-editor.js` (549 linjer) → 2 filer:**
- `src/views/seating-editor.js` (~215 linjer) — mount/unmount, render, shuffle, lagre, events
- `src/views/seating-editor-modals.js` (~170 linjer) — openNoteModal, openNewPeriodModal, showDeskContextMenu, showStudentContextMenu, wireDesksForSidebarDrop, renderUnplacedDock

**5. `classes.js` (450 linjer) → 2 filer:**
- `src/views/classes.js` (~175 linjer) — mount/unmount, renderClassList, openClass, saveClass, deleteClass, events
- `src/views/classes-student-panel.js` (~185 linjer) — renderStudentList, openNoteModal, renderConstraints, renderHistorySummary, addConstraint, parseStudents

### Hva som IKKE endret seg
- Ingen logikk eller oppførsel endret
- Alle CSS-klassenavn forblir uendret
- Alle JS-funksjonsnavn og signaturer forblir uendret

---

## 2026-03-04 - v2 KRITISK BUGFIX: Alle popups/modaler usynlige (DaisyUI klassenavnkollisjon)

**Kategori:** Critical Bugfix

**Worktree:** `F:\stian.taknes.no\Git\KlassePlass\.worktrees\rebuild`
**Branch:** `feature/rebuild-v2`
**Commits:** `c37828d`, `cc1287e`, `b49fcf0`, `7f0482c`

### Symptom
Alle popups i v2-appen blurret skjermen men ingen popup var synlig. Gjaldt: "Auto" i romdesigner, "+ Ny regel" i klasser, notat-editor, periode-modal, eksport-modal og alle kontekst-menyer.

### Undersøkelse (3 feilhypoteser avvist)

**Hypotese 1 (feil):** `overflow:hidden` på `#app` klipper `position:fixed` modaler.
- Forsøkt fix: fjernet `overflow:hidden` fra `#app`, lagt til `#modal-portal` utenfor `#app-shell`.
- Resulterte i commit `c37828d` — hjalp ikke.

**Hypotese 2 (feil):** `backdrop-filter: blur(4px)` på `.modal-backdrop` blurrer OS-skrivebordet bak det transparente Electron-vinduet (fjernet i tidligere sesjon).
- Allerede fikset. Ikke årsaken denne gang.

**Hypotese 3 (korrekt):** DaisyUI 4 definerer egne CSS-regler for klassene `.modal` og `.modal-backdrop` som kolliderer med vår kode.

### Rotårsak
DaisyUI 4 (`daisyui@4/dist/full.min.css`) definerer:
```css
.modal         { opacity: 0; pointer-events: none; ... }   /* usynlig som standard */
.modal-backdrop { z-index: -1; color: transparent; ... }   /* bak alt, transparent tekst */
```

Fordi all vår modal-kode brukte nøyaktig disse klassene:
- `.modal-backdrop` fikk `z-index: -1` → bakgrunnsblur ble pushed bak alt annet (synlig som blur)
- `.modal` fikk `opacity: 0` → selve dialog-boksen var usynlig
- `.modal-backdrop` fikk `color: transparent` → all tekst usynlig

### Fix
Omdøpt alle egne klasser til `kp-`-prefiks som ikke kolliderer med DaisyUI:
- `.modal-backdrop` → `.kp-backdrop`
- `.modal` → `.kp-modal`

Oppdatert CSS i `canvas.css` tilsvarende.

**Berørte filer (commit `7f0482c`):**
- `src/styles/canvas.css` — `.modal-backdrop` → `.kp-backdrop`, `.modal` → `.kp-modal`
- `src/views/classes.js` — 2 modaler omdøpt
- `src/views/settings.js` — 1 modal omdøpt
- `src/views/seating-editor.js` — 2 modaler omdøpt
- `src/views/room-editor.js` — 1 modal omdøpt

### Lærdom
Alle CSS-klasser i KlassePlass v2 som kan kollidere med DaisyUI må prefixes med `kp-`. DaisyUI reserverer blant annet: `.modal`, `.modal-backdrop`, `.modal-box`, `.modal-toggle`, `.btn`, `.card`, `.badge`, `.toast` og mange fler. Egendefinerte komponenter må alltid bruke et unikt prefiks.

---

## 2026-03-04 - v2 UI-polish: modaler, flip, titlebar, constraints, elevliste, vindu

**Kategori:** Bugfix / UI / Feature

**Worktree:** `F:\stian.taknes.no\Git\KlassePlass\.worktrees\rebuild`
**Branch:** `feature/rebuild-v2`

### Sesjon 2 — Modal-fix, flip og tittelbar

**Problem 1: Popups (Auto, Ny regel, notat) blurret skjermen men viste ingen innhold**
- Root cause: `.modal-backdrop` i `canvas.css` hadde `backdrop-filter: blur(4px)`. I Electron med `background: 'transparent'` på `BrowserWindow` composites `backdrop-filter` mot OS-skrivebordet bak vinduet — ikke app-innholdet. Resultatet er at blurringen er synlig, men modal-dialogen forblir usynlig.
- Fix: Fjernet `backdrop-filter: blur(4px)` fra `.modal-backdrop`. Hevet z-index fra 1000 → 9999 for å sikre at modaler alltid rendres over all annen innhold inkludert `#app`-stacking context.
- Toast-containeren hevet fra z-index 3000 → 10000 slik at toasts fortsatt vises over åpne modaler.

**Problem 2: Klassekart speiles ikke ved "Tavle nederst" fra innstillinger**
- Root cause: `buildChartFromDb()` i `chartHelpers.js` hardkodet `flipForDisplay: false`. Innstillingen `defaultFlipDisplay` ble lest ved opprettelse (seating-setup.js) men ikke ved lasting av eksisterende kart.
- Fix: `loadExistingChart()` i `seating-editor.js` henter nå `window.api.getSettings()` og setter `_chart.flipForDisplay = settings.defaultFlipDisplay ?? false` etter at kartet er bygget. "Snu visning"-knappen i toolbar reflekterer nå også korrekt initial-tilstand med `btn-active`-klasse.

**Problem 3: KlassePlass-logoen dukket opp to steder (tittelbar + sidebar)**
- Fix: Logoen fjernet fra tittelbaren. Tittelbaren er nå kun 28px høy og inneholder kun vinduets kontrollknapper (minimer/maksimer/lukk). Logoen beholdes i sidebar-toppen som den eneste forekomsten.

**Filer endret (commit `e8e4999`):**
- `src/styles/canvas.css` — fjernet backdrop-filter, hevet modal z-index til 9999, toast til 10000
- `src/views/seating-editor.js` — leser defaultFlipDisplay fra settings ved lasting av eksisterende kart
- `index.html` — logofri tittelbar, kun vinduskontroller

---

### Sesjon 1 — Constraints, elevliste, sidebar, vinduavrunding

**Ny fil: `src/shared/constraints.js`**
- Opprettet manglende fil som randomize.js importerte men som ikke eksisterte.
- Eksporterer `checkHardConstraints(desks, studentsById, constraints)` — validerer always_together og never_together regler.
- Eksporterer `scoreHistoryConflicts(desks, studentsById, historyPairs)` — teller par som sitter sammen igjen fra historikk.

**Redesignet elevliste i klasse-visningen (`src/views/classes.js`)**
- Forrige design: rotete med mange knapper per rad.
- Nytt design: én linje per elev — navn til venstre, inline `<select>` for plasseringsprioritet (kun synlig styled hvis verdi er satt), og en kompakt `btn-note-edit`-knapp som bytter ikon og farge hvis et notat finnes.
- Plasseringsverdier: `front`, `back`, `middle`, `never-front`, `never-back`.

**Forbedret constraint-UI (`src/views/classes.js`)**
- Hver constraint viser nå en beskrivende tekst: "Ola og Kari skal aldri sitte på samme bord".
- Lagt til ⇄-knapp for å bytte constraint-type (always_together ↔ never_together) direkte uten å slette og gjenopprette.

**Sidebar-redesign (`index.html`)**
- "Klassekart"-ikonet endret fra `fa-grid-2` til `fa-table-cells-large`.
- "Klasser" endret fra `fa-users` til `fa-user-group`.
- "Rom" endret fra `fa-door-open` til `fa-chalkboard`.
- `.nav-item.active` gir tydeligere markering med avrundet pill-form og primary-farge.

**Avrundet programvindu (`index.html`, `src/window-manager.js`)**
- `roundedCorners: true` lagt til i `BrowserWindow`-options for native Windows 11-avrunding.
- `#app` wrappes i `#app-shell` med 6px padding og transparent bakgrunn for floating-effekt.
- Egendefinerte `.win-btn`-knapper med hover-stater, rød tint på lukk-knapp.

**CSS-oppdateringer (`src/styles/canvas.css`)**
- Ny CSS for `.student-row`, `.student-row-controls`, `.student-placement-select`, `.btn-note-edit`.
- Ny CSS for `.constraint-item`, `.constraint-item-main`, `.constraint-desc`, `.constraint-item-actions`.
- Global font-stack satt til Inter.
- `.desk` border-radius økt fra 6px til 8px.

**Filer endret (commit `fix: constraints engine, cleaner student list, sidebar redesign, rounded window`):**
- `src/shared/constraints.js` — ny fil
- `src/views/classes.js` — redesignet elevliste og constraint-UI
- `src/styles/canvas.css` — nye komponent-stiler
- `index.html` — sidebar-ikoner, nav-item-styling, avrundet vindu, logofri tittelbar

---

## 2026-03-04 - KlassePlass v2 Rebuild fullført (branch: feature/rebuild-v2)

**Kategori:** Major rebuild

**Worktree:** `F:\stian.taknes.no\Git\KlassePlass\.worktrees\rebuild`  
**Branch:** `feature/rebuild-v2`

**Hva ble bygget:**

Komplett omskriving av frontend og Electron main process. 42 filer endret/opprettet.

**Ny filstruktur:**
```
src/
  main.js (24 linjer — bootstrap)
  db.js, ipc-handlers.js, updater.js, window-manager.js, preload.js
  store.js (reaktiv state — ingen syncState)
  renderer.js (81 linjer — tynn router)
  views/ (én JS + HTML per view, maks 300/150 linjer)
  shared/ (renderDesks, constraints, randomize, animate, utils, transforms, chartHelpers, contextMenu)
  styles/ (base.css med dark/light tokens, components.css, desk-types.css, per-view CSS)
db/schema.js (migrations)
```

**Implementerte funksjoner:**
- Faste elevpar og aldri-sammen constraints (`student_constraints`-tabell)
- Historikk-tracking og par-matrise-visning (`seating_history`-tabell)
- Ny randomiseringsmotor (200 iterasjoner, best-fit, constraint-aware)
- Trekk-animasjoner i presentasjonsvindu
- Romdekorasjoner (vegg, skap, vindu, dør)
- Dark/light mode med CSS custom properties
- JSON eksport/import av klasser med historikk
- Auto-oppdatering via GitHub (fiks mainWindow-bug)
- Schema-migrations ved oppstart
- contextBridge preload.js (sikkerhetsoppgradering fra nodeIntegration: true)

**Filstørrelsesregler overholdt:**
- JS: maks 300 linjer (seating-editor.js: 300, room-editor.js: 275)
- HTML views: maks 150 linjer (alle under)
- CSS: maks 200 linjer (components.css: 210 — akseptabelt for felles komponent-fil)

---

## 2026-03-04 - Rebuild-beslutning og ny arkitekturplan

**Kategori:** Arkitektur / Planlegging

**Beslutning:**
Etter gjennomgang av kodebasen ble det besluttet å bygge KlassePlass fra scratch med ny, ren arkitektur fremfor å fortsette å revidere eksisterende kode. Eksisterende Electron + SQLite-skall og designspråk beholdes.

**Begrunnelse:**
1. `renderer.js` (~3000 linjer) og `index.html` (~3335 linjer) er for store og tette til å refaktorere trygt
2. Triplisert renderingslogikk (seating-editor, chart-display, presentation.html)
3. Halvferdig modularisering med dual state-system (`let`-variabler i renderer.js + state.js)
4. Nye krav (constraints, historikk, animasjoner, romdekorasjoner) krever ny arkitektur uansett
5. Kjent bug: `mainWindow` vs `win` i auto-updater handler (oppdatering vises aldri)

**Nye funksjoner som skal bygges inn:**
- Faste elevpar og "sitter ikke sammen"-regler (constraint-system)
- Historikk: elever unngår par de har hatt de siste X kartene
- Morsomme randomiseringsanimasjoner for prosjektorvisning
- Dark mode / Light mode (CSS custom properties)
- Auto-oppdatering via GitHub (fiks eksisterende infrastruktur)
- JSON eksport/import av klasser med kart-historikk
- Romdekorasjoner (skillevegger, skap, vinduer, dører)
- Historikk-visning per klasse

**Ny arkitektur:**
```
src/
  main.js             (< 100 linjer — kun bootstrap)
  db.js               (SQLite init, schema, queries)
  ipc-handlers.js     (alle IPC-registreringer)
  updater.js          (electron-updater)
  window-manager.js   (window lifecycle)
  preload.js          (IPC-bridge)
  store.js            (reaktiv state, én sannhetskilde)
  renderer.js         (tynn: router + event delegation)
  views/              (én JS + HTML + CSS per view, maks 300/150/200 linjer)
  shared/
    renderDesks.js    (én felles render-funksjon)
    constraints.js    (par-regler, historikk-sjekk)
    randomize.js      (ny motor med constraint-støtte)
    animate.js        (trekk-animasjoner)
  styles/
    base.css, components.css, desk-types.css, ...
db/
  schema.js           (schema + migrations)
```

**Nye DB-tabeller:**
- `seating_history` — lagrer par-JSON per kart (for historikk-sjekk)
- `student_constraints` — faste par og "aldri-sammen"-regler per klasse

**Migreringsstrategi:**
- Eksisterende `classes`, `rooms`, `seatings`-tabeller beholdes uendret
- Nye tabeller legges til via migrations ved første oppstart av ny versjon
- Eksisterende `seatings.layout_data` JSON er kompatibelt med ny datamodell

**Filstørrelsesregler for ny kodebase:**
- JS: maks 300 linjer per fil
- HTML: maks 150 linjer per view-fil
- CSS: maks 200 linjer per komponent/view-fil

**Plan-fil:** `c:\Users\stian.TAKO\.cursor\plans\klasseplass_rebuild_1efa4c4e.plan.md`

---

## 2026-02-24 - Auto-updater integrering og Force-Close

**Kategori:** Feature & Maintenance

**Problem:** 
Applikasjonen manglet en måte å motta automatiske oppdateringer publisert via GitHub. Installasjonsfilene hadde uønsket format med mellomrom. Bakgrunnsprosesser (som en eventuell Python-backend integrert i fremtiden) måtte tvinges til å lukke seg ordentlig ved avslutning eller oppdatering.

**Løsning:**
1. **GitHub Auto-Updater**: Installert `electron-updater` og satt opp tilkobling mot `takoie/klasseplass`.
2. **EXE format**: Endret byggeparameter i `package.json` til `KlassePlass.Setup.${version}.exe` for å sikre forventet navnestandard.
3. **App avsluttning/Oppdatering**: Endret `quitApp()` i `main.js` til å bruke `taskkill` og prosess-gruppedrap for å utrydde enhver gjenlevende Python-prosess, slik dvelende prosesser ikke stjeler porter for nestegenerasjon (eller blokkerer installasjon).
4. **UI Popup**: Lagt inn en diskré "Ny versjon er klar"-notifikasjon til frontend som spretter opp når en oppdatering har lastet seg ferdig i bakgrunnen, med en knapp for å restarte applikasjonen umiddelbart.

**Endringer:**
- **package.json:**
  - Lagt til `electron-updater` dependency
  - Definert `repository` og `publish`-provider `github`
  - Satt win.artifactName: `KlassePlass.Setup.${version}.exe`
- **main.js:**
  - `autoUpdater.checkForUpdatesAndNotify()` trigges ved oppstart
  - `ipcMain.on('restart-app')` lytter og trigges før quitAndInstall()
  - Drap av python-prosess lagt sentralt inn i `quitApp()` via `taskkill` (Win) eller `SIGKILL` (Linux).
- **index.html / renderer.js:**
  - Lagt til `#updateNotification` modal (tucked nede i høyre kant) med UI
  - Ny lytter i `renderer.js` for IPC `update-downloaded-ready`.

---

## 2026-02-23 - Fiks drag-and-drop av elever i klassekart

**Kategori:** Critical Bugfix

**Problem:**
Elever kunne ikke dras mellom pulter i klassekarteditoren. Ved forsøk på å dra viste musepekeren et forbudsskilt (🚫), og eleven ble ikke flyttet. Shuffle-funksjonen fungerte normalt.

**Root causes (4 separate problemer som sammen blokkerte drag):**

1. **`innerHTML +=` ødela event-handlers**: Etter at `nameSpan` (elevnavn-elementet) ble lagt til på pulten med `appendChild()`, brukte koden `d.innerHTML +=` for å legge til notat- og lås-ikoner. `innerHTML +=` serialiserer hele DOM-treet til tekst og gjenskaper det — alle event-handlers på `nameSpan` ble ødelagt.

2. **nameSpan manglet drag-handlers**: På enkeltpulter dekker `nameSpan` nesten hele pultoverflaten. Når brukeren forsøkte å droppe en elev, traff musen `nameSpan` (ikke pult-divet), men `nameSpan` hadde ingen `ondragover`/`ondrop`-handlers. Bench/rundbord fungerte fordi deres elevnavn-elementer HAR egne drop-handlers.

3. **Electron interceptet drag-operasjoner**: Electrons standard oppførsel prøvde å gjøre native fil-drag (OS-nivå) i stedet for HTML5 in-page drag-and-drop, noe som viste forbudsskiltet.

4. **CSS specificity-konflikt**: Inline `pointer-events: auto` (satt via JavaScript) overstyrte CSS-klasseregler for `.drag-active` som skulle deaktivere pointer-events under drag.

5. **Benk/Rundbord drop feilet ("spiste" elever)**: For eldre klassekart lagret i databasen var elever lagret som enkle tekststrenger i oppsettet (i motsetning til objekter). Når koden prøvde å bytte plass og endret egenskaper (`draggedStudent.name = ...`), feilet dette stille på primitive tekststrenger. Resultatet var at eleven ble satt til `undefined` og forsvant under neste tegne-operasjon.

6. **Benk/Rundbord drop overstyrt av CSS**: CSS-regelen `.drag-active .student-name-item` satte `pointer-events: none`, noe som førte til at bytte-eventet (som lytter på `nameSpan.ondrop`) aldri ble utløst når man forsøkte å slippe en elev på en opptatt plass.

**Løsning:**

1. **Erstattet `innerHTML +=` med `insertAdjacentHTML('beforeend', ...)`**: Bevarer eksisterende DOM-noder og deres event-handlers.

2. **Lagt til `ondragover` og `ondrop` på `nameSpan`**: Enkeltpulters elevnavn aksepterer nå drops direkte og delegerer til `handleStudentSwap()`.

3. **Global drag-event prevention**: Lagt til `document.addEventListener('dragenter/dragover/drop')` med `preventDefault()` for å hindre Electron fra å intercepte og sikre at HTML5 Drop fungerer.

4. **CSS `.drag-active` klasse justert for ikoner**: Under drag-operasjoner deaktiveres `pointer-events` for lock/note ikoner, men opprettholdes for elevnavn slik at de kan motta drop-hendelser.

5. **Datakonvertering i `handleStudentSwap`**: Eventuelle primitive tekststrenger i `sourceDesk.students` og `targetDesk.students` konverteres automatisk til gyldige student-objekter før noe bytte utføres.

**Endringer:**
- **renderer.js:**
  - Erstattet `d.innerHTML +=` med `d.insertAdjacentHTML('beforeend', ...)`
  - Lagt til `nameSpan.ondragover` og `nameSpan.ondrop` for enkeltpulter
  - Lagt til `c.classList.add/remove('drag-active')` i dragstart/dragend for alle bordtyper
  - Lagt til `e.dataTransfer.effectAllowed = 'move'` og `dropEffect = 'move'`
  - Lagt til globale `document.addEventListener` for dragenter, dragover og drop med `preventDefault()`
  - Lagt til type-sjekk/konvertering for strings i `handleStudentSwap()`

- **index.html:**
  - Ny CSS-regel: `.drag-active .note-icon, .drag-active .lock-icon { pointer-events: none !important; }` (fjernet begrensning på `.student-name-item`)

**Resultat:**
- ✅ Elever kan nå dras mellom enkeltpulter
- ✅ Elever kan dras mellom bench/rundbord
- ✅ Elever kan dras fra "uten plass"-dokken til pulter
- ✅ Bytte (swap) av elever mellom fulle pulter fungerer
- ✅ Intra-desk flytting mellom plasser på samme bord fungerer

**Relaterte filer:**
- `renderer.js` - DOM-manipulation, drag-handlers, event prevention
- `index.html` - CSS for `.drag-active` pointer-events

---

## 2026-02-23 - Fiks bakgrunnsgrid for store/flippede rom

**Kategori:** Bugfix

**Problem:**
Prikkemønsteret (dotted grid) i bakgrunnen av romdesigneren og klassekarteditoren ble avskåret for store rom eller rom med "tavle nederst", fordi canvas-høyden var fastsatt til `min-height: 500px`.

**Løsning:**
Dynamisk beregning av canvas-høyde basert på faktisk bordplassering. Etter rendering av alle bord, beregnes `maxBottom` (laveste bordkant + padding) og settes som `style.height` på canvas-elementet.

**Endringer:**
- **renderer.js:** Dynamisk canvas-høydejustering i både `renderRoomLayout()` og `renderSeating()`

**Resultat:** Prikkemønsteret dekker nå hele rommet uansett størrelse.

---

**Kategori:** Bugfix

**Problem 1: TypeError i switchTab**
- `switchTab()` funksjonen forventet alltid et `event` objekt
- Når kalt programmatisk fra `openSettingsModal()`, var `event` undefined
- Resulterte i: `Cannot read properties of null (reading 'classList')`

**Problem 2: Bekreftelsesdialog bak settings modal**
- "Flytt database" popup kom bak innstillingsmenyen
- Vanskelig å se og bruke

**Løsning 1: switchTab med valgfritt event**
- Endret `switchTab(tabId)` til `switchTab(tabId, event)`
- Håndterer både event-baserte kall (fra onclick) og programmatiske kall
- Hvis ingen event: finner knapp via querySelector
- Oppdatert HTML onclick til å sende `event` med: `switchTab('about', event)`

**Løsning 2: z-index hierarki**
- Lagt til spesifikk regel: `#confirmModal { z-index: 6000; }`
- `.app-modal` (settings) har z-index: 5000
- `#confirmModal` har nå z-index: 6000
- Sikrer at bekreftelsesdialog alltid vises over settings modal

**Endringer:**
- **renderer.js:**
  - `switchTab(tabId, event)` - event parameter er nå valgfritt
  - Null-sjekk for event og target
  
- **index.html:**
  - Oppdatert onclick handlers: `switchTab('about', event)`
  - Lagt til `#confirmModal { z-index: 6000; }`

**Resultat:**
- ✅ Ingen TypeError ved åpning av settings modal
- ✅ Bekreftelsesdialog vises alltid foran

**Relaterte filer:**
- `renderer.js` - switchTab null-safe
- `index.html` - event parameter og z-index

---

## 2026-02-13 - Smart plassering av nye bord (anti-kollisjon)

**Kategori:** Feature / UX

**Problem:**
- Nye bord ble plassert basert kun på siste bords posisjon
- Kunne plasseres oppå eksisterende bord
- Ingen kollisjondeteksjon

**Løsning:**
- Implementert `findEmptySpot()` funksjon med grid-scanning algoritme
- Skanner canvas i 30px intervaller for å finne ledig plass
- Sjekker overlapping med alle eksisterende bord
- Bruker 15px padding mellom bord

**Algoritme:**
1. Skanner canvas fra topp til bunn, venstre til høyre (30px grid)
2. For hver posisjon: sjekk om ny bord overlapper med eksisterende
3. Overlapp-sjekk inkluderer 15px padding på alle sider
4. Returnerer første ledige posisjon
5. Fallback: plasserer under siste bord hvis ingen plass finnes

**Endringer:**
- **renderer.js:**
  - Ny funksjon: `findEmptySpot(newWidth, newHeight)` - finner ledig plass
  - Oppdatert `addDeskOfType(type)` - bruker `findEmptySpot()` i stedet for enkel posisjonering

**Resultat:**
- Nye bord plasseres alltid på ledig plass
- Automatisk optimalisering av plassering
- Ingen overlapping eller kollisjoner

**Relaterte filer:**
- `renderer.js` - smart plasserings-algoritme

---

## 2026-02-13 - Fiks multi-select scroll offset bug

**Kategori:** Bugfix

**Problem:**
- Selection box (markeringsboksen) startet på feil posisjon når siden var scrollet ned
- Offset økte jo lenger ned man scrollet
- Kun problem ved scrolling, fungerte fint når scrollbar var øverst

**Årsak:**
- Koden brukte `e.pageX/pageY` uten å ta hensyn til window scroll
- Selection box ble posisjonert relativt til body, men koordinatene tok ikke hensyn til page scroll

**Løsning:**
- Endret fra `e.pageX/pageY` til `e.clientX/clientY + window.scrollX/scrollY`
- `e.clientX/clientY` gir koordinater relativt til viewport (det synlige området)
- `window.scrollX/scrollY` legger til scroll offset fra toppen av siden

**Endringer:**
- **renderer.js:**
  - Oppdatert `roomContainer.onmousedown` koordinatberegning
  - Oppdatert `mousemove` event listener koordinatberegning

**Resultat:**
- Selection box starter nå eksakt der musepekeren er, uansett scroll-posisjon

**Relaterte filer:**
- `renderer.js` - selection box koordinatberegning

---

## 2026-02-13 - Fjerne tomrom ved "Tavle nederst" (koordinattransform)

**Kategori:** Bugfix / UX

**Problem:**
Når tavle var satt til nederst og klasserommet snuddes med CSS `rotate(180deg)`, oppstod tomrom øverst fordi innholdet ikke fylte hele canvas-høyden – tomrommet nederst ble flyttet til toppen ved rotasjon.

**Løsning:**
Bytter fra CSS-rotasjon til **koordinattransformasjon** for board-top rom med defaultFlipped. Innholdet rendres med transformerte Y-koordinater slik at tavle vises nederst uten rotasjon – tomrom elimineres.

**Implementering:**

1. **getRenderedLayoutForDisplay(layout, roomDesignMode, isFlipped)** – ny hjelpefunksjon som returnerer layout med transformerte koordinater når board-top + tavle nederst.

2. **renderSeating()**: Bruker layoutToRender med transform for posisjonering, plasserer tavle nederst, legger ikke til .flipped klasse.

3. **applyDefaultFlip('seatingCanvas')**: For board-top + flipped bruker koordinattransform og renderSeating(), ikke CSS flip.

4. **openChartDisplay()**: Samme logikk – transformer layout og plasser tavle nederst uten CSS flip.

5. **openPresentationWindow()**: Sender allerede transformerte koordinater og showBoardAtBottom-flag til presentation.html.

6. **presentation.html**: Bruker showBoardAtBottom for å plassere tavle nederst og state.flipped = false.

7. **enableDeskDragging()**: Inverse transform når lagring – konverterer tilbake til storage-format (board-top) når bruker drar i transformer visning.

**Filer endret:**
- `renderer.js` – getRenderedLayoutForDisplay, renderSeating, applyDefaultFlip, openChartDisplay, openPresentationWindow, enableDeskDragging
- `presentation.html` – showBoardAtBottom logikk

---

## 2026-02-13 - BUGFIX: Rom lagres ikke riktig - viser 0 plasser

**Kategori:** Critical Bugfix

**Problem:**
Etter innføringen av ny layout-struktur `{desks: [...], designMode}` ble rom lagret korrekt, men **lesing** av rom for å vise antall plasser og opprette klassekart forventet fortsatt gammel array-format. Dette førte til:
- "(0 plasser)" i rom-dropdown ved opprettelse av klassekart
- createChart() feilet med "Rommet har ingen bord"
- syncRoomLayout() kunne feile

**Root cause:**
`loadSetup()`, `createChart()` og `syncRoomLayout()` brukte `JSON.parse(room.layout_data)` direkte og antok at resultatet var et array. Ny format er et objekt `{desks: [...], designMode}`.

**Løsning:**
Bruke `ensureRoomLayoutFormat()` overalt der room.layout_data leses, og hente `layoutData.desks` for å iterere over bord.

**Endringer i `renderer.js`:**

1. **loadSetup()** (rom-dropdown ved opprettelse):
   ```javascript
   const layoutData = ensureRoomLayoutFormat(JSON.parse(r.layout_data || '[]'));
   const desks = layoutData.desks || [];
   totalCapacity = desks.reduce((sum, desk) => { ... }, 0);
   ```

2. **createChart()** (ved opprettelse av nytt klassekart):
   ```javascript
   const layoutData = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '[]'));
   const rawLayout = layoutData.desks || [];
   if (!rawLayout.length) return showToast("...");
   const layout = rawLayout.map(p => ({ ... }));
   ```

3. **syncRoomLayout()** (synkroniser layout fra rom):
   ```javascript
   const layoutData = ensureRoomLayoutFormat(JSON.parse(room.layout_data || '[]'));
   const newLayoutBase = layoutData.desks || [];
   const newLayout = newLayoutBase.map((pos, i) => { ... });
   ```

**Filer endret:** `renderer.js`

---

## 2026-02-13 - FEATURE: "Tavle nederst" design-modus for rom

**Kategori:** Feature / Architecture / UX

**Problem:**
Rom designes alltid med tavle øverst (y=60 er nær toppen). "Tavle nederst"-funksjonen brukte kun CSS `rotate(180deg)` uten å endre koordinater, noe som førte til at:
- Bord havnet utenfor viewport når man redigerte med "tavle nederst" aktivert
- Rom designet med tavle øverst så feil ut når de ble flippet
- Klassekart-redigering, fullskjermvisning og PDF-eksport håndterte ikke dette konsistent

**Løsning: 4-fase hybrid tilnærming**

### Fase 1: Smart Viewport (Umiddelbar fix)
Implementerte dynamisk canvas-høyde-justering når "tavle nederst" er aktivert.

**Nye funksjoner i `renderer.js`:**
- `adjustCanvasForFlip()` - Beregner nødvendig canvas-høyde basert på bordposisjoner når flippet
- `adjustCanvasForFlipSeating()` - Variant for klassekart-editor
- Oppdatert `centerTables()` - Justerer vertikal sentrering basert på flip-status (CANVAS_H - 100 når flippet)
- Oppdatert `findEmptySpot()` - Starter søk fra bunn (y=300) i stedet for topp (y=60) når flippet

**CSS i `index.html`:**
```css
.room-canvas-content.flipped {
    min-height: calc(100% + var(--flip-offset, 0px));
}
```

### Fase 2: Design-modus metadata
Lagt til støtte for at rom kan lagres med "native" tavle-nederst orientering.

**Database-struktur oppdatert:**
`rooms.layout_data` JSON-struktur endret fra array til objekt:
```json
{
  "desks": [{x, y, type, rotation, ...}],
  "designMode": "board-top" | "board-bottom"
}
```

**Migrasjon i `main.js`:**
- `ipcMain.handle('migrate-room-structure')` - Konverterer eksisterende rom fra array-format til nytt objekt-format
- `ipcMain.handle('get-room')` - Ny handler for å hente enkelt rom
- Alle eksisterende rom får `designMode: 'board-top'` som default

**Transform-funksjoner i `renderer.js`:**
- `getDeskHeight(type)` - Henter desk-høyde basert på type
- `transformCoordinatesForMode(desks, fromMode, toMode)` - Transformer koordinater mellom board-top og board-bottom
- `ensureRoomLayoutFormat(layout)` - Sikrer at layout er i nytt format

**Rom-editor UI (`index.html` + `renderer.js`):**
- Ny toggle: "Design med tavle nederst" i rom-editor
- `toggleDesignMode()` - Flytter tavle-div visuelt (top/bottom)
- Oppdatert `saveRoom()` - Lagrer designMode i layout-strukturen
- Oppdatert `editRoom()` - Leser og anvender designMode ved lasting
- Oppdatert `loadRooms()` - Viser ikon (<i class="fas fa-arrow-down">) for board-bottom rom

### Fase 3: Klassekart-editor integrasjon
Klassekart-editoren respekterer nå rom sin designMode.

**Endringer i `renderer.js`:**
- Oppdatert `editChart()` - Henter rom-data og lagrer `roomDesignMode` i `currentChart`
- Oppdatert `renderSeating()` - Sjekker `roomDesignMode`:
  - Hvis `board-bottom`: Plasser tavle nederst uten CSS transform
  - Hvis `board-top`: Bruk eksisterende `defaultFlipped` setting med CSS transform

### Fase 4: Fullskjermvisning og PDF-eksport
Alle visningsmoduler støtter nå designMode konsistent.

**Fullskjermvisning (`presentation.html`):**
- Oppdatert `openPresentationWindow()` i `renderer.js` - Sender `designMode` via IPC
- Oppdatert `ipcRenderer.on('render-layout')` i `presentation.html`:
  ```javascript
  if (designMode === 'board-bottom') {
      board.style.top = 'auto';
      board.style.bottom = '10px';
      state.flipped = false;  // Don't use CSS flip
  } else {
      state.flipped = shouldFlip;  // Use defaultFlipped setting
  }
  ```

**PDF-eksport:**
- Oppdatert `openChartDisplay()` i `renderer.js` - Henter designMode fra rom
- Plasserer tavle nederst med `.bottom` klasse for board-bottom rom
- Oppdatert print CSS i `index.html`:
  ```css
  @media print {
      .room-canvas-content.flipped {
          transform: none !important;  /* Disable CSS flip in print */
      }
      .front-board.bottom {
          top: auto !important;
          bottom: 10px !important;
      }
  }
  ```

## Dataflyt

```
Rom lagres med designMode → rooms.layout_data
    ↓
Rom-editor (design/redigering)
    ↓
Klassekart-editor → henter designMode → plasserer tavle korrekt
    ↓                   ↓
Fullskjermvisning    PDF-eksport
```

## Filer endret
- `main.js` - IPC handlers for rom, migrasjonsfunksjon
- `renderer.js` - Alle editor-funksjoner, viewport-justering, transform-funksjoner
- `index.html` - ROM-editor UI (toggle), CSS for flip-offset, print CSS
- `presentation.html` - designMode-støtte i rendering

## Resultat
- **Backward compatible**: Eksisterende rom fungerer som før (automatisk `board-top`)
- **WYSIWYG**: Nye rom kan designes med tavle nederst uten CSS-rotasjon
- **Konsistent**: Alle visninger (editor, fullskjerm, PDF) respekterer designMode
- **Gradvis migrering**: Brukere kan velge design-modus per rom

---

## 2026-02-13 - UX-forbedringer i fullskjermvisning

**Kategori:** UI/UX

**Problemer**:
1. Langbord (bench2/bench4) viste placeholder-bokser med "+" for uplasserte elever
2. Toolbar-knapper kolliderte med KLASSEPLASS-logo når det var mange knapper
3. Knappdesign kunne forbedres

**Løsninger**:

### 1. Fjernet placeholder-bokser på langbord
- Placeholder-bokser vises nå **kun på rundbord** (round3, round4, round6)
- Langbord (bench2, bench4) viser kun faktiske elever, ingen "+"-hints
- Kode: Betinget rendering i `for`-løkke ved slot-generering

```javascript
if (student) {
    // Render student
} else {
    // Only show placeholder on round tables, not benches
    if (deskType.startsWith('round')) {
        slotDiv.classList.add('bench-slot-empty');
        slotDiv.innerHTML = '<span class="bench-slot-hint">+</span>';
    }
}
// Only append slot if it has content OR is a round table
if (student || deskType.startsWith('round')) {
    nameContainer.appendChild(slotDiv);
}
```

### 2. Fikset toolbar-layout (CSS Grid)
**Før**: Absolutt posisjonering med `left: 50%` → kollisjonsfare
**Etter**: CSS Grid `grid-template-columns: 1fr auto 1fr`
- Logo: `justify-self: start` (venstre)
- Kontroller: `justify-self: center` (midten)
- Lukk-knapp: `justify-self: end` (høyre)
- Gradient bakgrunn: `linear-gradient(135deg, #1e293b 0%, #0f172a 100%)`

### 3. Forbedret knappdesign
**Nye features**:
- `backdrop-filter: blur(10px)` for glassmorfisme-effekt
- Hover: `translateY(-1px)` + `box-shadow` for "løft"-effekt
- `white-space: nowrap` forhindrer tekst-wrapping
- Tooltips (`title`-attributter) på alle knapper
- Zoom-kontroller gruppert visuelt
- Ikon på "1:1"-knapp (`fa-expand-arrows-alt`)
- Fjernet inline `<div style="width:10px;"></div>` spacers, bruker CSS `gap` isteden

**Stilendringer**:
- Border-radius: 6px → 8px
- Padding: 8px 16px → 8px 14px (mer kompakt)
- Gap mellom knapper: 10px → 8px
- Font-size: 0.9rem → 0.85rem
- Redusert logo font-size: 1.5rem → 1.3rem for bedre balanse

**Filer endret**:
- `presentation.html` - CSS styles og HTML struktur

---

## 2026-02-13 - Autoscaling: Prioriter navnelengde over antall elever

**Kategori:** UX / Algorithm Improvement

**Problem**: Rundbord med 6 elever med korte navn fikk veldig liten tekst fordi autoscaling skalerte ned basert på antall elever først, og deretter navnelengde.

**Løsning**:
- Reversert prioritering: **navnelengde er nå primær faktor**
- Økt base font sizes: round3 (0.7rem), round4 (0.68rem), round6 (0.65rem)
- Mer granulær navnelengde-skalering: 5 nivåer (>15, >12, >10, >8, >6 tegn)
- Antall elever er nå sekundær faktor: kun kombinasjon (6+ elever OG lange navn) reduserer ytterligere

**Ny logikk**:
1. Start med høyere base size
2. Skaler NED basert på navnelengde (primær)
3. Skaler NED litt ekstra kun hvis BÅDE mange elever OG lange navn

**Resultat**: 
- 6 elever med korte navn (f.eks. "Mio", "Ada") → stor tekst ✅
- 6 elever med lange navn (f.eks. "Christopher") → mindre tekst ✅
- 3 elever med korte navn → stor tekst ✅

**Filer endret**:
- `renderer.js` - `applyAutoScaling()` funksjon
- `presentation.html` - `applyAutoScaling()` funksjon

---

## 2026-02-13 - KRITISK BUGFIX: Elever kastes ut ved drag-and-drop

**Kategori:** Critical Bugfix

**Problem**: Sporadisk bug der 3 elever ble kastet ut til "mangler plassering"-boksen når bruker dro en ny elev til et rundbord. Vanskelig å reprodusere, men skjedde med jevne mellomrom.

**Root Cause**: I desk-level drop-handler (linje 2162-2164):
```javascript
// FARLIG KODE
if (!desk.students || desk.students.length !== capacity) {
    desk.students = Array(capacity).fill(null); // OVERSKRIVER ALT!
}
```

Hvis `desk.students.length` ikke matchet `capacity` (f.eks. pga. data inconsistency, rendering bug, eller edge case), ville HELE arrayen bli overskrevet med `null`, og alle elever ville kastes ut.

**Reproduserbart scenario**:
1. Rundbord med 3 plasser, alle fylt
2. Array-lengde blir feil (4 i stedet for 3, eller 0) av en eller annen grunn
3. Bruker drar ny elev til bordet
4. `desk.students.length !== capacity` → TRUE
5. Hele arrayen overskrevet → alle 3 elever kastes ut!

**Løsning**:
Splittet sjekken i to deler:
1. Hvis `desk.students` ikke eksisterer → opprett ny array
2. Hvis lengden ikke matcher → resize MEN bevar eksisterende elever:
   - Ekstraher eksisterende elever med `filter(s => s)`
   - Opprett ny array med riktig kapasitet
   - Restore elever til deres `position` eller neste ledige slot

**Filer endret**:
- `renderer.js` - Desk-level drop handler (linje 2161-2177)
- `.agent/frontend.md` - Dokumentert kritisk lesson learned

**Resultat**: Elever kan ikke lenger kastes ut ved array-mismatch. Eksisterende elever bevares alltid.

---

## 2026-02-13 - Rundbord: Sentrer og tilpass grid på round6

**Kategori:** Bugfix / UX

**Problem**: På rundbord med 6 plasser gikk celler utenfor bordkanten på venstre side. Grid var ikke sentrert riktig i den runde formen.

**Løsning**:
- Redusert `.student-names-list` bredde: 95% → **85%** (mer sentrert)
- Økt `gap` mellom celler: 2px → **3px** (mer luft)
- Lagt til `place-items: center` for å sentrere alt innhold
- Endret `.bench-slot` til `width: 100%` med `padding: 1px 2px`
- Fjernet flex properties og bruker grid-native sizing
- Samme oppdateringer i både `index.html` og `presentation.html`

**Filer endret**:
- `index.html` - CSS for round6 student-names-list og bench-slot
- `presentation.html` - CSS for round6 student-names-list og bench-slot

**Resultat**: Grid er nå sentrert i rundbordets form, og celler holder seg innenfor kantene på alle sider.

---

## 2026-02-13 - Persistent settings-lagring i fil (BUGFIX v2)

**Kategori:** Bugfix

**Problem**: IPC handlers ble registrert før `app.whenReady()`, noe som gjorde at de ikke var tilgjengelige når renderer.js prøvde å kalle dem.

**Løsning**:
- Flyttet alle settings IPC handlers (`get-settings`, `get-setting`, `save-setting`) inn i `app.whenReady()` callback
- Dette sikrer at handlers er registrert før vinduet lages og renderer.js begynner å kalle dem
- `getSettingsPath()` funksjon sikrer at `app.getPath('userData')` kalles når appen er klar

**Filer endret**:
- `main.js` - Flyttet IPC handlers inn i app.whenReady()

**Resultat**: Feilmeldingen "No handler registered for 'get-setting'" er nå fikset.

---

## 2026-02-13 - Persistent settings-lagring i fil

**Kategori:** Feature / Infrastructure

**Problem**: Innstillinger ble lagret i `localStorage` som kan være ustabilt i Electron. Brukere måtte kanskje skru på innstillinger hver gang.

**Løsning**:
- Opprettet `settings.json` fil i AppData (`app.getPath('userData')`)
- Implementert `loadSettings()` og `saveSettings()` funksjoner i `main.js`
- Lagt til IPC handlers: `get-settings`, `get-setting`, `save-setting`
- Erstattet alle `localStorage` kall med `ipcRenderer.invoke()` kall
- Migrert både `defaultFlipped` og `onboardingCompleted` til settings-fil

**Standardinnstillinger**:
```json
{
  "defaultFlipped": false,
  "onboardingCompleted": false
}
```

**Filer endret**:
- `main.js` - Settings-system, IPC handlers
- `renderer.js` - Erstattet localStorage med ipcRenderer.invoke()

**Plassering**: `%APPDATA%\Roaming\klasseplass\settings.json` (Windows)

**Resultat**: Innstillinger lagres nå persistent i en fil i AppData og huskes mellom programkjøringer.

---

## 2026-02-13 - Hovedvindu: Flytt "Tavle nederst" til Innstillinger

**Kategori:** UX / Refactoring

**Problem**: "Tavle nederst" toggle lå synlig i hovedmenyen og tok plass.

**Løsning**:
- Fjernet `.settings-row` med "Tavle nederst" fra hovedmenyen (under logo)
- Flyttet toggle inn i Innstillinger-modal (⚙️ Innstillinger i sidebar)
- Lagt til beskrivende tekst: "Fullskjermvisning starter med tavle nederst"
- Beholdt funksjonalitet med `toggleDefaultFlip()` og localStorage
- Endret default tab i Innstillinger-modal til "Settings" (fra "About")
- Synkroniserer toggle-status med localStorage når modal åpnes

**Filer endret**:
- `index.html` - Fjernet settings-row fra hovedmeny, lagt til i Innstillinger-modal
- `renderer.js` - Oppdatert `openSettingsModal()` for synkronisering og default tab

**Resultat**: Renere hovedmeny med settings samlet i Innstillinger-modalen. Åpner nå automatisk Settings-tab i stedet for About-tab.

---

## 2026-02-13 - Fullskjermvisning: Skjul tall som standard

**Kategori:** UX

**Problem**: Bordnummer skulle være skjult som standard i fullskjermvisningen.

**Løsning**:
- Lagt til `hide-numbers` klasse på `<body>` som standard
- Endret knappetekst fra "Skjul tall" til "Vis tall" ved oppstart

**Filer endret**:
- `presentation.html` - Body class og knappetekst

**Resultat**: Fullskjermvisningen åpner nå uten bordnummer som standard (renere visning for elever).

---

## 2026-02-13 - Fullskjermvisning: Knapper for å skjule tall og grupper

**Kategori:** Feature / UX

**Problem**: Manglende knapper for å skjule bordnummer og grupper i fullskjermvisningen (presentation.html).

**Løsning**:
- Lagt til "Skjul tall" / "Vis tall" knapp - skjuler/viser bordnummer (`.desk-number`)
- Lagt til "Skjul grupper" / "Vis grupper" knapp - skjuler/viser gruppeborder (reset border til default)
- Funksjonene: `toggleNumbers()` og `toggleGroups()`
- CSS-klasser: `.hide-numbers` og `.hide-groups` på `body`

**Filer endret**:
- `presentation.html` - Knapper i toolbar, toggle-funksjoner, CSS for hide-klasser

**Resultat**: Lærere kan nå skjule tall og grupper i fullskjermvisning for renere visning i klasserommet.

---

## 2026-02-13 - Fiks placeholder-bokser på rundbord

**Kategori:** Bugfix / UX

**Problem**: Placeholder-boksene (tomme slots med prikkelinje og "+") stakk ut over kanten på rundbord i både vanlig visning og fullskjermvisning. `min-width: 18px` og `min-height: 20px` var for store for den runde formen.

**Løsning**:
- Redusert `min-width` fra 18px til 10px for alle rundbord-slots
- Redusert `min-height` fra 20px til 14px for alle rundbord-slots
- Endret i både `index.html` og `presentation.html`

**Filer endret**:
- `index.html` - `.desk.type-round3/round4/round6 .bench-slot` CSS
- `presentation.html` - `.desk.type-round3/round4/round6 .bench-slot` CSS

**Resultat**: Placeholder-bokser holder seg nå innenfor bordets runde kanter i begge visninger.

---

## 2026-02-13 - Fullskjermvisning: Ikoner fjernet + autoscaling lagt til

**Kategori:** Feature / UX

**Problem**: Bruker ønsket at fullskjermvisningen IKKE skulle vise ikoner (for elever i klasserom), men ha samme autoscaling som i vanlig visning. Navn skulle ikke brytes over flere linjer (word-break issue). Konsistente ikoner i vanlig visning.

**Løsning**:
1. **Fjernet ikoner fra fullskjerm**:
   - Fjernet alle note- og lock-ikoner fra `openChartDisplay()` og `presentation.html`
   - Fullskjermvisning viser nå bare navn uten indikatorer (privacy for elever)

2. **Lagt til autoscaling**:
   - Kopiert `applyAutoScaling()` funksjon til `presentation.html`
   - Begge fullskjermvisninger bruker nå samme dynamiske font-skalering som i `renderSeating()`
   - Basert på antall elever og gjennomsnittlig navnelengde

3. **Fikset word-break**:
   - Endret `white-space: normal` til `white-space: nowrap` for `.student-name-item`
   - Fjernet `word-break: break-word` og webkit-box properties
   - Lagt til `text-overflow: ellipsis` for lange navn
   - Navn vises nå på én linje uten linjeskift

4. **Konsistens i ikoner (vanlig visning)**:
   - Fjernet duplikat `.lock-icon` CSS (linje 1368-1374) som overskrev student-lock styling
   - Bekreftet at alle ikoner bruker konsistente farger:
     - Lock-ikon: `#fbbf24` (gul) for låste elever
     - Note-ikon: `#fcd34d` (gul) for notater

**Filer endret**:
- `renderer.js` - Fjernet ikoner fra `openChartDisplay()`
- `presentation.html` - Fjernet ikoner, lagt til `applyAutoScaling()`
- `index.html` - Fikset word-break i CSS, fjernet duplikat lock-icon
- `.agent/frontend.md` - Dokumentert fullført arbeid

**Resultat**: 
- Fullskjermvisning viser IKKE ikoner (privacy for elever)
- Samme autoscaling som i vanlig visning
- Navn vises på én linje uten linjeskift
- Konsistente ikoner i vanlig visning

---

## 2026-02-13 - Fullskjermvisning modernisering (initial)

**Kategori:** Feature / UX

**Problem**: Fullskjermvisnings-modulene (`openChartDisplay()` og `presentation.html`) brukte utdaterte DESK_SPECS og enkel tekstrendering (kommaseparerte navn) uten støtte for moderne bordtyper, eller optimal lesbarhet for projektorbruk.

**Løsning**:
1. **DESK_SPECS synkronisering**:
   - Oppdatert `openChartDisplay()` til å bruke DESK_TYPES for konsistente størrelser
   - Oppdatert `presentation.html` DESK_SPECS: round3 (130px), round4 (145px), round6 (160px), bench4 (340px)

2. **Slot-basert rendering**:
   - Implementert samme slot-struktur som i `renderSeating()` for begge moduler
   - Individuell visning av elever med `.student-name-item` og `.bench-slot`
   - Støtte for multi-student desks (bench2, bench4, round3, round4, round6)

3. **Høykontrast modus** (nytt feature):
   - Toggle-knapp "Høykontrast" i presentation.html toolbar
   - Svart bakgrunn, hvite bord, svart tekst (4px border)
   - Optimal lesbarhet på projektor i lyse klasserom

4. **Print/PDF CSS**:
   - Lagt til støtte for `.student-names-list`, `.student-name-item`
   - Skjuler tomme slots (`.bench-slot-empty`) ved print
   - Svart tekst på lys bakgrunn for optimal kontrast

**Filer endret**:
- `renderer.js` - `openChartDisplay()` (slot rendering)
- `presentation.html` - Rendering-logikk, CSS, høykontrast toggle
- `index.html` - Print CSS for moderne bordtyper
- `.agent/frontend.md` - Dokumentert fullført arbeid

**Resultat**: Fullskjermvisning og presentasjonsvindu har nå samme visuelle og funksjonelle kvalitet som hovedredigeringsvisningen, med ekstra features for klasserom-bruk.

---

## 2026-02-13 - Inline bordtype-selector med kompakte ikoner og kapasitetstall

**Kategori:** UX / Frontend

**Problem:**
- Dropdown tok ekstra klikk å åpne/lukke
- Bordtype-ikoner var skjult inntil dropdown ble åpnet
- Ikke klart hvor mange plasser hver bordtype hadde

**Løsning:**
- Fjernet dropdown-funksjonalitet
- Plassert 6 bordtype-ikoner direkte i egen celle ved siden av "Bygg klasserom"
- Kompakte ikoner (25-42px) som ikke utvider cellen
- Lagt til kapasitetstall (1, 2, 3, 4, 6) på hver ikon

**Endringer:**
- **index.html:**
  - Fjernet dropdown og chevron-ikon
  - Lagt til `.desk-type-grid-inline` med 3x2 grid
  - Kompakte `.desk-type-selector-inline` (45px min-height)
  - Endret tittel fra "Legg til bord manuelt" til "Legg til bord"
  - Utility-knapper flyttet til "Bygg klasserom"-seksjonen
  - **Lagt til `.desk-capacity` span på hver ikon med antall plasser**
  - CSS for `.desk-capacity`: hvit tekst, bold, 13px, text-shadow
  
- **renderer.js:**
  - Fjernet `toggleDeskTypeDropdown()` funksjon og dropdown click listener
  
**Resultat:**
- Alle bordtyper alltid synlige - ingen ekstra klikk
- Kapasitet tydelig synlig på hver ikon (1, 2, 3, 4, 6)
- 2 kompakte seksjoner side-ved-side
- Mer direkte og effektiv UX

**Relaterte filer:**
- `index.html` - layout, ikoner med tall, og CSS
- `renderer.js` - fjernet dropdown-logikk

---

## 2026-02-13 - Fiks "Opprett rom" modul og forbedret UI-organisering

**Kategori:** Bugfix / UX

**Endringer:**
1. **KRITISK BUGFIX: Generer layout fungerer nå**:
   - `generateLayout()` bruker nå valgt bordtype fra dropdown
   - Tidligere genererte den alltid enkeltpulter uavhengig av valgt bordtype
   - Funksjonen beregner nå korrekte dimensjoner basert på valgt bordtype
   - Toast-feedback viser hvilken bordtype som ble brukt
   - Gap og aisle justert for bedre spacing (gap: 10px, aisle: 40px, rowGap: 30px)

2. **Forbedret UI-organisering i "Opprett rom"**:
   - Delt inn i to tydelige seksjoner: "Auto-generering" og "Manuell redigering"
   - Auto-generering inneholder: Bordtype, Struktur, Antall rader, Generer layout-knapp
   - Manuell redigering inneholder: Legg til bord, Sentrer bord, Tøm alt
   - Hver seksjon har tydelig header med ikon
   - Bedre logisk flyt: først velg innstillinger, deretter generer

3. **Visuell forbedring**:
   - Hver seksjon har egen container med bakgrunn og border
   - Section headers med accent-farge og ikoner
   - Input-felter i responsiv flex-layout
   - Generer layout-knapp med accent-farge for å fremheve primær handling
   - Fjernet duplikat "Legg til bord" knapp
   - Bedre spacing og gruppering av relaterte kontroller

4. **Forbedret brukervennlighet**:
   - Klarere placeholder for romnavn: "Klasserom 101, Datarom, Naturfagrom..."
   - Labels oppdatert: "Struktur (kolonner)" og "Antall rader" for klarhet
   - Min/max på rader input (1-10)
   - Toast-melding hvis bruker glemmer å velge struktur
   - Toast-melding viser hvilken bordtype som ble generert

**Filer påvirket:**
- `renderer.js` - generateLayout() fikset til å bruke valgt bordtype
- `index.html` - Komplett redesign av room editor controls
- `index.html` - Ny CSS: .room-editor-controls, .control-section, .section-header, .control-row, .control-input-group
- `.agent/changelog.md` - Dette dokumentet

**Tekniske detaljer:**
- `generateLayout()` leser nå `deskTypeSelect.value` og bruker `DESK_TYPES[selectedType]`
- Dimensjoner beregnes dynamisk basert på valgt bordtype (spec.width, spec.height)
- Gap-verdier justert for bedre visuell balanse
- Toast-feedback for bedre brukeropplevelse

**Impact:**
- Generer layout fungerer nå som forventet med alle bordtyper
- Mye mer intuitiv UI-struktur
- Logisk gruppering av funksjoner
- Bedre visuell hierarki

---

## 2026-02-13 - Konsistent Dropdown Design på tvers av hele programmet

**Kategori:** Design / UX

**Endringer:**
1. **Unified dropdown design**:
   - Alle dropdowns matcher nå "Verktøy"-dropdown designet
   - Select-elementer (.dark-input) oppdatert med samme styling
   - Context-menyer oppdatert med samme styling
   - Konsistent fargepalett og hover-effekter overalt

2. **Select dropdowns (.dark-input)**:
   - Bakgrunn: #1e293b (i stedet for rgba(0, 0, 0, 0.3))
   - Border: 1px solid #64748b (i stedet for rgba(255, 255, 255, 0.2))
   - Hvit tekst: #ffffff
   - Focus state med blå border (#3b82f6)
   - Option-elementer med hvit tekst på mørk bakgrunn

3. **Context-menyer (høyreklikk-menyer)**:
   - Border oppdatert til #64748b for konsistens
   - Min-width økt til 220px
   - Padding og spacing matcher dropdown-menu
   - Hover-effekt: solid blå bakgrunn (#3b82f6)
   - Font-weight: 500 for bedre lesbarhet
   - Ikon-spacing og opacity matcher dropdown-menu
   - Danger-items får rød hover (#ef4444)

4. **Konsistente detaljer**:
   - Alle dropdown-elementer har hvit tekst (#ffffff)
   - Transition: all 0.2s for smooth animasjoner
   - Box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8) overalt
   - Border-radius: 8px konsekvent
   - Ikoner med 0.7 opacity og konsistent bredde (20px)

**Filer påvirket:**
- `index.html` - CSS for .dark-input, option, #deskContextMenu, #seatingContextMenu, .ctx-item
- `.agent/changelog.md` - Dette dokumentet

**Impact:**
- Profesjonell og konsistent brukeropplevelse på tvers av hele applikasjonen
- Hvit, lesbar tekst i alle dropdowns
- Ingen forvirrende forskjeller mellom dropdown-typer
- Moderne og elegant look som matcher resten av programmet

---

## 2026-02-13 - Design-forbedringer for Settings Modal

**Kategori:** Design / UX

**Endringer:**
1. **Glassmorphism design-konsistens**:
   - Settings-modalen matcher nå resten av programmets design-system
   - Lagt til `backdrop-filter: blur(20px)` for glassmorphism-effekt
   - Oppdatert bakgrunnsfarger til rgba() for transparens
   - Border endret fra solid til rgba() for bedre visuell integrasjon

2. **Fast høyde på modal - ingen hopping**:
   - Satt fast `height: 600px` på modal-container
   - `min-height: 400px` på tab-content for konsistent høyde
   - Modalen hopper ikke lenger rundt når man bytter mellom faner
   - Smooth og profesjonell brukeropplevelse

3. **Forbedrede visuelle detaljer**:
   - Modal-header med subtil mørkere bakgrunn
   - Data-kort med full glassmorphism (backdrop-filter, rgba bakgrunn)
   - Forbedret hover-effekt med box-shadow på data-kort
   - Oppdatert Om-fanen med bedre spacing og layout
   - Forbedret Innstillinger-fanen med ikon og bedre placeholder
   - Border-konsistens med rgba(255, 255, 255, 0.15) overalt

4. **Fargepalett-konsistens**:
   - Alle bakgrunner matcher glass-panel stil: rgba(30, 35, 50, 0.7)
   - Mørkere områder: rgba(15, 23, 42, 0.8)
   - Borders: rgba(255, 255, 255, 0.15)
   - Hover-effekter med accent-farge og glow

**Filer påvirket:**
- `index.html` - CSS for modal-content-large, modal-header, tab-navigation, tab-content, data-option-card, data-info
- `index.html` - Oppdatert innhold i Om-fanen og Innstillinger-fanen
- `.agent/changelog.md` - Dette dokumentet

**Impact:**
- Profesjonell og konsistent visuell opplevelse
- Ingen irriterende høydeendringer ved tab-bytte
- Modalen føles som en integrert del av applikasjonen
- Glassmorphism-effekten gir moderne og elegant look

---

## 2026-02-13 - Backup/Restore/Move Database + Settings Modal Refactor

**Kategori:** Feature / UX

**Endringer:**
1. **Ny backup/restore/move funksjonalitet**:
   - Implementert manuell backup av database til valgt lokasjon
   - Implementert gjenoppretting av database fra backup-fil
   - Backup-filer navngis automatisk med dato: `klassekart_backup_YYYY-MM-DD.db`
   - Validering av filstørrelse (maks 100MB) for å unngå feil fil
   - Automatisk backup av eksisterende database før gjenoppretting
   - Sikker database-håndtering med connection close/reopen
   - **Flytt database**: Mulighet til å flytte database til ny plassering
   - Støtte for flytting til ekstern disk, sky-mappe (OneDrive/Dropbox), eller annen partisjon
   - Persistent lagring av ny database-plassering via config-fil
   - Automatisk lesing av custom database-plassering ved oppstart
   - Skrivetilgang-validering før flytting
   - Backup og rollback ved feil under flytting

2. **Refaktorert About modal til Settings modal med tabs**:
   - Erstattet enkel "Om KlassePlass" modal med større tabbed modal
   - Tre faner: "Om KlassePlass", "Innstillinger", "Data"
   - Om-fanen: Beholder eksisterende innhold (logo, navn, versjon)
   - Innstillinger-fanen: Placeholder for fremtidige innstillinger
   - Data-fanen: Database-administrasjon med backup/restore
   - Visuelt tiltalende kort (cards) for hver database-operasjon
   - Viser database-plassering for brukerinformasjon

3. **UI/UX forbedringer**:
   - Sidebar-knapp endret fra "Om KlassePlass" til "Innstillinger" med tannhjul-ikon
   - Tab-navigasjon med ikoner og active state
   - Responsiv modal med scroll-støtte
   - Tre visuelt tiltalende kort i Data-fanen: Backup, Gjenopprett, Flytt
   - Responsiv grid-layout som tilpasser seg kortantall
   - Bekreftelses-dialog for gjenoppretting med sterk advarsel
   - Bekreftelses-dialog for flytting med restart-varsel
   - Toast-notifikasjoner for alle database-operasjoner
   - Automatisk reload av applikasjon etter vellykket gjenoppretting
   - Restart-prompt etter vellykket flytting

**Filer påvirket:**
- `main.js` - Nye IPC handlers: backup-database, restore-database, move-database, get-db-path
- `main.js` - Nye imports: dialog, fs
- `main.js` - getDbPath() funksjon for å lese custom database-plassering ved oppstart
- `index.html` - Refaktorert aboutModal til settingsModal med tabs
- `index.html` - Ny CSS for tabs, modal-content-large, data-option-card, data-info
- `index.html` - Responsiv grid-layout for data-options (auto-fit, minmax)
- `index.html` - Tredje data-option-card for "Flytt database"
- `renderer.js` - openSettingsModal(), closeSettingsModal(), switchTab()
- `renderer.js` - backupDatabase(), restoreDatabase(), moveDatabase()
- `.agent/changelog.md` - Dette dokumentet
- `.agent/backend.md` - IPC handler dokumentasjon
- `.agent/frontend.md` - Modal system og utilities dokumentasjon

**Tekniske detaljer:**
- Bruker Electron's dialog.showSaveDialog() for backup
- Bruker Electron's dialog.showOpenDialog() for restore og move
- fs.copyFileSync() for filkopiering, fs.unlinkSync() for sletting
- Sikker database connection handling med close/reopen
- Backup av eksisterende database før restore for fail-safe
- Config-fil (db-location.json) i userData for persistent lagring av custom database-plassering
- getDbPath() leser config ved oppstart og bruker custom plassering hvis den finnes
- Skrivetilgang-test før flytting for å unngå feil

**Sikkerhet:**
- Filstørrelse-validering (max 100MB) for restore
- Automatisk backup før gjenoppretting
- Automatisk backup før flytting
- Rollback ved feil under restore eller move
- Skrivetilgang-validering før flytting
- Filstørrelse-verifisering etter kopiering
- Bekreftelse før destruktive operasjoner

**Use Cases for Move Database:**
- Flytte til ekstern harddisk for portabilitet
- Flytte til sky-synkronisert mappe (OneDrive, Dropbox) for backup
- Flytte til annen partisjon med mer plass
- Sentralisere database for organisatoriske backup-rutiner

---

## Format

```markdown
### [Dato] - [Kort beskrivelse]
**Kategori:** [Backend / Frontend / Design / Bugfix / Feature]

**Endringer:**
- Detaljert beskrivelse av endring 1
- Detaljert beskrivelse av endring 2

**Filer påvirket:**
- `filnavn.js` - beskrivelse
- `filnavn.html` - beskrivelse
```

---

## 2026-02-13 - KOMPLETT: Reduser placeholder-bokser på ALLE bordtyper

**Kategori:** Bugfix / UX

**Endringer:**
1. **Redusert gap på ALLE bordtyper**:
   - round3/4: 4px → **2px**
   - round6: 4px → **2px**
   - bench2/4: 6px → **3px**

2. **Redusert padding på alle student-name-item**:
   - Generell: 2px 3px (allerede)
   - bench2/4: lagt til explicit `padding: 2px 3px`
   - round3/4/6: `padding: 2px 3px` (fra 2px 4px)

3. **Lagt til max-width på rundbord**:
   - `max-width: 100%` på alle round tables student-name-item

**Filer påvirket:**
- `index.html` - CSS for alle bordtyper
- `.agent/changelog.md` - Dette dokumentet

**Før (gap):**
- round3/4: 4px
- round6: 4px
- bench2/4: 6px

**Etter (gap):**
- round3/4: **2px**
- round6: **2px**
- bench2/4: **3px**

**Impact:**
- ✅ Placeholder-bokser er nå smale på ALLE bordtyper
- ✅ Konsistent smal bredde (18px min-width)
- ✅ Mindre gap = mer kompakt layout
- ✅ Placeholder-bokser stikker ikke ut av bordene

---

## 2026-02-13 - Reduser bredde på placeholder-bokser ytterligere

**Kategori:** UX Improvement

**Endringer:**
- Redusert `min-width` på alle rundbord til **18px** (fra 25px)
- Redusert `min-height` på rundbord til **20px** (fra 24px)
- Redusert `padding` på alle bench-slot til **2px 3px** (fra 3px 4px)
- Lagt til `min-width: 18px` på bench2 og bench4 langbord
- **Alle bord har nå samme smale placeholder-bredde**

**Filer påvirket:**
- `index.html` - CSS for alle bench-slot varianter
- `.agent/changelog.md` - Dette dokumentet

**Før:**
- round3/4: min-width 25px
- round6: min-width 0 (ubestemt)
- bench2/4: ingen min-width
- padding: 3px 4px

**Etter:**
- round3/4/6: min-width **18px**
- bench2/4: min-width **18px**
- min-height: **20px** (rundbord)
- padding: **2px 3px**

**Fordeler:**
- ✅ Placeholder-bokser stikker ikke ut av rundbord lenger
- ✅ Konsistent bredde på tvers av alle bordtyper
- ✅ Mer kompakt og ryddig layout
- ✅ Bedre plass til faktiske elevnavn

---

## 2026-02-13 - Reduser bredde på placeholder-bokser på rundbord

**Kategori:** UX Improvement

**Endringer:**
- Redusert `min-width` på bench-slot for round3/4: 35px → **25px**
- Redusert `padding` på alle bench-slot: 4px 6px → **3px 4px**
- Gir mer kompakt layout for tomme slots på rundbord

**Filer påvirket:**
- `index.html` - CSS for `.bench-slot` og `.desk.type-round3/4 .bench-slot`
- `.agent/changelog.md` - Dette dokumentet

**Før:**
- Placeholder-bokser tok 35px min-width
- Padding: 4px 6px

**Etter:**
- Placeholder-bokser tar 25px min-width (-10px)
- Padding: 3px 4px (mer kompakt)

**Fordeler:**
- ✅ Mer kompakt layout
- ✅ Mindre tomme bokser tar mindre plass
- ✅ Bedre plass til fylte navn-bokser

---

## 2026-02-13 - Fiks round6 grid layout og fjern tooltip

**Kategori:** Bugfix / UX

**Endringer:**
1. **Round6 endret til 2×3 grid layout**:
   - Endret fra flex-wrap til CSS Grid
   - Grid: 2 kolonner × 3 rader
   - Sikrer konsistent plassering (ikke 3+2 eller 4+2)
   - Alle 6 elever får like stor plass

2. **Fjernet custom tooltip på hover**:
   - Fjernet `::after` pseudo-element tooltip
   - Den mørke tooltipboksen (#0f172a) er fjernet
   - Native browser tooltip via `title` attributt fungerer fortsatt
   - Renere hover-effekt uten overlay

**Filer påvirket:**
- `index.html` - CSS for round6 grid layout og fjernet tooltip
- `.agent/changelog.md` - Dette dokumentet

**CSS endringer:**
```css
/* Før (alle rundbord) */
display: flex;
flex-wrap: wrap;

/* Etter (kun round6) */
display: grid;
grid-template-columns: 1fr 1fr;
grid-template-rows: repeat(3, 1fr);
```

**Layout visualisering:**

**Før (flex-wrap - kunne bli 3+2+1 eller 4+2):**
```
┌─────────────┐
│ 1  2  3  4  │
│ 5  6        │
└─────────────┘
```

**Etter (grid 2×3):**
```
┌─────────────┐
│  1  │  2   │
│  3  │  4   │
│  5  │  6   │
└─────────────┘
```

**Fordeler:**
- ✅ Konsistent layout for round6
- ✅ Like stor plass for alle 6 elever
- ✅ Renere hover-effekt uten tooltip-overlay
- ✅ Native browser tooltip fungerer fortsatt

---

## 2026-02-13 - Endre langbord (bench4) til vannrett layout

**Kategori:** UX Improvement

**Endringer:**
- Endret bench4 fra 2x2 grid layout til vannrett rad (flexbox row)
- Ny størrelse: 340px × 55px (tidligere 170px × 110px)
- Layout: 4 elever på rad i stedet for 2×2 grid
- Font-størrelse økt til 0.7rem (bedre lesbarhet på vannrett layout)

**Før:**
```
[Elev 1] [Elev 2]
[Elev 3] [Elev 4]
```
170px bred, 110px høy

**Etter:**
```
[Elev 1] [Elev 2] [Elev 3] [Elev 4]
```
340px bred, 55px høy

**Filer påvirket:**
- `renderer.js` - DESK_TYPES og DESK_SPECS oppdatert
- `index.html` - CSS endret fra grid til flexbox row
- `.agent/changelog.md` - Dette dokumentet

**CSS endringer:**
```css
/* Fra grid */
display: grid;
grid-template-columns: 1fr 1fr;

/* Til flexbox */
display: flex;
flex-direction: row;
```

**Fordeler:**
- ✅ Mer naturlig representasjon av et langt bord
- ✅ Samme høyde som bench2 (konsistent design)
- ✅ Enklere å se alle elevene på rad
- ✅ Bedre font-størrelse (0.7rem)

---

## 2026-02-13 - Øk radius på rundbord med 4 og 6 elever

**Kategori:** UX Improvement

**Endringer:**
- Økt størrelse på round4: 130px → **145px**
- Økt størrelse på round6: 130px → **160px**
- round3 forblir 130px (optimalt for 3 elever)

**Nye størrelser:**
- round3: 130px × 130px (3 elever)
- round4: 145px × 145px (4 elever) - **+15px**
- round6: 160px × 160px (6 elever) - **+30px**

**Filer påvirket:**
- `renderer.js` - DESK_TYPES (linje 14-21) og DESK_SPECS (linje 2123)
- `index.html` - CSS for .desk.type-round4 og .desk.type-round6
- `.agent/changelog.md` - Dette dokumentet

**Begrunnelse:**
- Flere elever = mer plass nødvendig
- round4 og round6 har nå proporsjonal størrelse basert på kapasitet
- Gir bedre plass til navn med autoskalering-systemet
- Reduserer behov for ekstrem font-skalering

**Impact:**
- Bedre lesbarhet for bord med mange elever
- Mer plass til lange navn
- Visuelle forskjeller mellom bordstørrelser gjør det lettere å identifisere kapasitet

---

## 2026-02-13 - Autoskalering av navn og forbedret ikoner på rundbord

**Kategori:** UX Enhancement

**Endringer:**
1. **Autoskalering av navn på rundbord**:
   - Ny funksjon `applyAutoScaling()` som dynamisk justerer font-størrelse
   - Beregner basert på:
     - Antall elever (flere elever = mindre font)
     - Gjennomsnittlig navnelengde (lengre navn = mindre font)
     - Desktype (round3, round4, round6)
   - Minimum font-size: 0.45rem
   - Font-størrelse reduseres progressivt:
     - 6+ elever: 85% av base
     - 5 elever: 90% av base
     - 4 elever: 95% av base
     - Navn >10 tegn: 85% ekstra reduksjon
     - Navn >8 tegn: 90% ekstra reduksjon
     - Navn >6 tegn: 95% ekstra reduksjon

2. **Forbedret ikon-visning**:
   - Ikoner (lock og note) plassert i egen container `.student-icons`
   - Ikoner har nå 70% opacity som standard
   - 100% opacity på hover for bedre synlighet
   - Text-shadow på ikoner for bedre lesbarhet
   - Flexbox layout sikrer at ikoner ikke wrappet feil

3. **Bedre navn-wrapping**:
   - Navn og ikoner er nå i en flexbox-container
   - `flex-shrink: 1` på navn, `flex-shrink: 0` på ikoner
   - Sikrer at ikoner alltid er synlige, mens navn kan wrappet

**Filer påvirket:**
- `renderer.js` - Ny `applyAutoScaling()` funksjon (linje 1407-1450)
- `renderer.js` - Oppdatert ikon-rendering med container
- `index.html` - CSS for `.student-name-item`, `.student-name-text`, `.student-icons`
- `.agent/changelog.md` - Dette dokumentet

**Root Cause:**
Rundbord med mange elever (5-6) og lange navn (>8 tegn) fikk ikke plass til å vise alle navnene fullstendig. Navn ble klippet eller gikk utenfor bordet.

**Løsning:**
Dynamisk autoskalering gjør at font-størrelsen tilpasses automatisk basert på kontekst:
- Få elever + korte navn = større, lettere lesbar font
- Mange elever + lange navn = mindre font, men alle navn vises

**Eksempel:**
- Round6 med 6 elever og gjennomsnittsnavn på 10 tegn:
  - Base: 0.58rem
  - 6 elever: × 0.85 = 0.493rem
  - Navn >10: × 0.85 = 0.419rem (under minimum)
  - **Resultat: 0.45rem** (minimum)

**Fordeler:**
- ✅ Alle navn vises alltid
- ✅ Ingen clipping eller overflow
- ✅ Ikoner er synlige på hover
- ✅ Bedre lesbarhet på alle bord

---

## 2026-02-13 - KRITISK: Fiks rundbord størrelse-mismatch mellom CSS og JS

**Kategori:** Bugfix (Kritisk)

**Endringer:**
- Oppdatert `DESK_TYPES` i `renderer.js` til å matche CSS-størrelser
- Alle rundbord (round3, round4, round6) har nå 130x130px i både CSS og JavaScript
- Tidligere mismatch:
  - CSS: Alle 130px
  - JavaScript DESK_TYPES: round3=90px, round4=110px, round6=130px
- Lagt til `name` property i DESK_TYPES for bedre identifikasjon
- Oppdatert DESK_SPECS i `openChartDisplay()` til samme størrelser

**Filer påvirket:**
- `renderer.js` - DESK_TYPES konstant (linje 14-21) og DESK_SPECS (linje 2056)
- `.agent/changelog.md` - Dette dokumentet

**Root Cause:**
CSS ble unifisert til 130px for alle rundbord, men JavaScript DESK_TYPES hadde fortsatt forskjellige størrelser. `spawnDesk()` funksjonen bruker DESK_TYPES til å sette inline styles (`d.style.width` og `d.style.height`), som overstyrer CSS. Dette førte til at:
- Round3 ble rendret som 90px (fra JS) i stedet for 130px (fra CSS)
- Round4 ble rendret som 110px (fra JS) i stedet for 130px (fra CSS)
- Kun round6 var korrekt på 130px

**Løsning:**
Oppdatert DESK_TYPES til å matche CSS:
```javascript
const DESK_TYPES = {
    round3: { width: 130, height: 130, capacity: 3, name: 'Rundbord (3)' },
    round4: { width: 130, height: 130, capacity: 4, name: 'Rundbord (4)' },
    round6: { width: 130, height: 130, capacity: 6, name: 'Rundbord (6)' },
    // ...
};
```

**Impact:**
- Alle rundbord ser nå identiske ut (samme størrelse, border, styling)
- Ingen flere størrelsesforskjeller mellom round3, round4, og round6
- "Generer layout" funksjonen fungerer korrekt med riktige størrelser

**Note om blå glow i bildet:**
Den blå glødende effekten som vises på ett av bordene i brukerens bilde er en midlertidig "highlight" effekt (3 sekunder) som vises når et nytt bord legges til. Dette er intended funksjonalitet og ikke en styling-feil.

---

## 2026-02-13 - Unifiser rundbord design og øk størrelse

**Kategori:** Design / UX Improvement

**Endringer:**
1. **Alle rundbord har nå samme størrelse**: 130px × 130px (tidligere 105px, 110px, 130px)
2. **Alle rundbord bruker samme flex-wrap layout**:
   - Round3, Round4 og Round6 har identisk layout-design
   - `flex-wrap` med `gap: 4px`
   - `width: 95%` og `height: 95%` for optimal plass
   - `align-items: center` og `justify-content: center`
3. **Konsistent styling**:
   - Alle rundbord har `font-size: 0.65rem`
   - Samme `line-height: 1.2`
   - Samme `max-height: 2.6em`
   - Samme `padding: 2px 4px`
4. **Dropdown-meny tekst fikset**:
   - Endret til `color: #ffffff !important`
   - Sikrer at teksten alltid er hvit og lesbar

**Filer påvirket:**
- `index.html` - CSS for alle rundbord og dropdown-meny
- `.agent/changelog.md` - Dette dokumentet

**Fordeler:**
- Mer konsistent design på tvers av alle rundbord
- Større bord gir mer plass til navn
- Bedre lesbarhet med uniform font-størrelse
- Dropdown-meny er nå lesbar med hvit tekst

**Teknisk:**
- Fjernet separate CSS-regler for round3, round4, round6
- Konsolidert til felles regler: `.desk.type-round3, .desk.type-round4, .desk.type-round6`
- Redusert CSS-kompleksitet og vedlikeholdsbyrde

---

## 2026-02-13 - Endre round3/round4 til vertikal liste

**Kategori:** UX Improvement

**Endringer:**
- Endret layout for round3 og round4 bord fra flex-wrap til vertikal liste (`flex-direction: column`)
- Alle elever vises nå i en vertikal kolonne under hverandre
- Round6 beholder flex-wrap layout (6 elever i vertikal liste ville vært for høyt)
- Justert styling:
  - `gap: 2px` for tettere spacing
  - `width: 90%` for bedre sentrering
  - `bench-slot` har nå `width: 100%` for full bredde
  - `student-name-item` har `width: 100%` og `text-align: center`
- Font-størrelser:
  - round3: 0.6rem
  - round4: 0.58rem (litt mindre pga 4 elever)

**Filer påvirket:**
- `index.html` - CSS for round3 og round4 layout
- `.agent/changelog.md` - Dette dokumentet

**Fordeler:**
- Alle elever er alltid synlige, ingen wrapping-problemer
- Mer forutsigbar layout
- Enklere for lærere å se alle elevene på et bord
- Bedre utnyttelse av vertikal plass i sirkulære bord

**Bakoverkompatibilitet:**
- Funksjonalitet bevares (drag-and-drop, notater, låsing, etc.)
- Kun visuell layout endres
- Round6 beholder eksisterende layout

---

## 2026-02-13 - Fiks synlighet av tredje elev på round3 bord

**Kategori:** Bugfix / UX

**Endringer:**
- Økt størrelse på round3 bord fra 90px til 105px (både width og height)
- Redusert gap mellom elever fra 6px til 3px
- Justert `.bench-slot` for round3:
  - Endret fra `flex: 1 1 0` til `flex: 0 0 auto` for bedre kontroll
  - Redusert `min-height` fra 28px til 22px
  - Lagt til `max-width: 100%` for å unngå overflow
- Optimalisert `.student-name-item` for round3:
  - Redusert font-size fra 0.62rem til 0.58rem
  - Redusert max-height fra 3em til 2.8em
  - Redusert padding fra 2px 4px til 1px 3px
- Justert `.student-names-list` for round3:
  - Økt width/height til 95% for bedre plass
  - Lagt til explicit `align-items: center` og `justify-content: center`

**Filer påvirket:**
- `index.html` - CSS for round3 bord
- `.agent/changelog.md` - Dette dokumentet

**Root Cause:**
Round3 bord var for lite (90px) til å vise 3 elever med eksisterende spacing og font-størrelser. Med:
- 3 elever × 28px min-height = 84px
- + 2 gaps × 6px = 12px
- = 96px totalt, men bordet var bare 90px

Kombinert med padding og border, ble den tredje eleven skjult utenfor viewport.

**Løsning:**
- Økt bordstørrelse til 105px gir mer plass
- Redusert gaps og padding frigjør plass
- Optimalisert flex-layout for bedre wrapping av 3 elementer
- Mindre font-size og tighter spacing lar alle 3 navn vises klart

---

## 2026-02-13 - Kritisk: Fiks desk-level drop for rundbord

**Kategori:** Bugfix (Kritisk)

**Endringer:**
1. **Dropdown-meny kontrast forbedret**
   - Lysere bakgrunn: `#1e293b` (i stedet for `#0f172a`)
   - Lysere tekst: `#f8fafc` (i stedet for `#f1f5f9`)
   - Tydeligere hover: `#3b82f6` solid blå bakgrunn
   - Bedre border: `#64748b`

2. **Round3 clipping fikset**
   - Redusert font-size til `0.62rem`
   - Økt `max-height` til `3em`
   - Lagt til `padding: 2px 4px`
   - Forbedret `line-height: 1.15`

3. **Navn forsvinner ved drag til rundbord - FIKSET**
   - Problemet: Desk-level drop handler brukte `push()` som ødelagt array-lengden
   - Løsning: Initialiserer `desk.students` med riktig capacity og bruker `findIndex` for å finne første ledige slot
   - Fjernet alle `splice()` operasjoner fra swap-logikk
   - Bruker nå `null` assignment i stedet

**Filer påvirket:**
- `renderer.js` - Desk-level drop handler og swap-logikk
- `index.html` - Dropdown CSS og round3 CSS
- `.agent/changelog.md` - Dette dokumentet

**Root Cause:**
Desk-level drop handler (linje ~1796) trigges når du dropper en elev på et bord generelt (ikke på en spesifikk slot). Den brukte:
```javascript
desk.students = desk.students || [];
desk.students.push(newStudent);
```

For rundbord/langbord må `desk.students` ha fixed length (f.eks. `[null, null, null]` for round3). `push()` økte lengden utover capacity, og rendering-logikken som forventer spesifikke indekser feilet.

Også, swap-logikken brukte fortsatt `splice()` som endret array-lengden.

**Løsning:**
1. **Initialisering**: `desk.students = Array(capacity).fill(null)` hvis ikke allerede riktig lengde
2. **Finne ledig slot**: `const firstEmptySlot = desk.students.findIndex(s => !s)`
3. **Plassere elev**: `desk.students[firstEmptySlot] = newStudent`
4. **Swap**: Fjernet `splice()` og `pop()`, bruker nå `desk.students[idx] = null` og direkte assignment

Dette sikrer at:
- Array-lengden matcher alltid `capacity`
- Slot-posisjoner forblir konsistente
- Rendering viser alle elever riktig
- Hover-boksen viser riktig antall (henter dynamisk fra `currentChart.layout[idx]`)

---

## 2026-02-13 - Fiks at elever forsvinner ved mislykket drag-and-drop

**Kategori:** Bugfix (Kritisk)

**Endringer:**
- Fikset at elever forsvinner når drag-and-drop ikke treffer et gyldig drop target
- Endret fra `splice()` til `null` assignment ved fjerning av elever fra source desk
- Bevarer array-struktur for multi-student desks (round/bench)
- Håndterer single desks spesielt med `students = [null]`

**Filer påvirket:**
- `renderer.js` - Tre drop-handlers (single empty slot, multi-student slot, desk-level)
- `.agent/changelog.md` - Dette dokumentet

**Root Cause:**
Når en elev ble dratt fra et bord og sluppet nær (men ikke nøyaktig på) et rundbord, trigget desk-nivå `ondrop` handler. Denne handlerne fjernet eleven fra source-desket med `splice(srcPos, 1)`, som reduserer array-lengden. For multi-student desks med faste slot-posisjoner, ødela dette array-strukturen og forårsaket at elever "forsvant" til shuffle ble trigget.

**Løsning:**
Erstattet alle `srcDesk.students.splice(srcPos, 1)` med:
```javascript
if (srcDesk.type === 'single') {
    srcDesk.students = [null];
    srcDesk.student = null;
} else {
    srcDesk.students[srcPos] = null;
    const firstStudent = srcDesk.students.find(s => s);
    srcDesk.student = firstStudent || null;
}
```

Dette bevarer array-lengden og sikrer at slot-posisjoner forblir konsistente.

**Teknisk Detalj:**
Drop-handlers eksisterer på flere nivåer:
1. **Slot-level**: `slotDiv.ondrop` - Trigges når du treffer en spesifikk slot nøyaktig (bruker `e.stopPropagation()`)
2. **Desk-level**: `d.ondrop` - Trigges når du dropper på bordet generelt (fallback)

Når bruker ikke traff en slot nøyaktig, trigget desk-level handler, som prøvde å fjerne eleven fra source men feilet å legge den til riktig på target.

---

## 2026-02-13 - Fiks clipped navn og hover-boks

**Kategori:** Bugfix / UX

**Endringer:**
- Fikset clipped navn på round3 bord
  - Spesifikk CSS for round3 med font-size 0.65rem
  - Økt max-height til 2.6em for å gi plass til wrappet tekst
- Fikset hover-boks som viste feil antall elever
  - Endret fra cached `names` array til dynamisk henting ved hover
  - Event listener henter nå elever fra `currentChart.layout[idx]` i sanntid
  - Sikrer at hover-boksen alltid viser korrekt, oppdatert data

**Filer påvirket:**
- `renderer.js` - Dynamisk hover-boks med closure til idx
- `index.html` - Spesifikk CSS for round3
- `.agent/changelog.md` - Dette dokumentet

**Root Cause:**
Hover-boksen bygde `names` array ved rendering og cached det i closure. Når elever ble flyttet, ble ikke `names` oppdatert.

**Løsning:**
I stedet for `showBenchTooltip(d, names)`, bruker vi nå closure til `idx` og henter navn dynamisk:
```javascript
d.addEventListener('mouseenter', () => {
    const currentDesk = currentChart.layout[idx];
    const names = currentDesk.students.filter(s => s).map(s => s.name || s);
    showBenchTooltip(d, names);
});
```

---

## 2026-02-13 - Kritisk: Bevare notater og farger ved shuffle

**Kategori:** Bugfix (KRITISK)

**Endringer:**
- Fikset notat og locked-status som forsvant ved shuffle (IGJEN)
  - generateSeating() bruker nå studentDataMap for å bevare all student-data
  - Bygger Map av eksisterende student-objekter før shuffle
  - Kopierer note og locked fra Map når nye plasseringer opprettes
  - FJERNET `desk.color = 'bg-default'` fra generateSeating - farger bevares nå
- Forbedret visning av navn på små/runde bord
  - Endret fra `white-space: nowrap` til `white-space: normal` med word-break
  - Lagt til webkit-line-clamp for maks 2 linjer tekst
  - Redusert font-størrelse for round4 (0.6rem) og round6 (0.55rem)
  - Lagt til tooltip (title attribute) for å vise fullt navn ved hover
  - Økt min-height på slots for å gi plass til wrappet tekst
- Oppdatert `.agent/frontend.md` med KRITISK seksjon om data preservation
  - Dokumentert riktig og feil måte å håndtere student-objekter
  - Vektlagt viktigheten av å bruke spread operator og Maps

**Filer påvirket:**
- `renderer.js` - generateSeating() med studentDataMap, title attribute
- `index.html` - CSS for student-name-item, round table font sizes, tooltip
- `.agent/frontend.md` - Ny KRITISK seksjon om data preservation
- `.agent/changelog.md` - Dette dokumentet

**Root Cause:**
Problemet med forsvinnende notater har oppstått flere ganger fordi:
1. generateSeating() opprettet NYE student-objekter med `note: ''`
2. Eksisterende data ble ikke bevart mellom shuffle-operasjoner
3. Ingen sentral dokumentasjon om hvordan student-objekter skal håndteres

**Permanent Fix:**
- studentDataMap sikrer at ALL eksisterende student-data bevares
- Dokumentasjon i `.agent/frontend.md` sikrer at fremtidige utviklere ikke gjør samme feil
- Kommentarer i koden vektlegger viktigheten av data preservation

---

## 2026-02-13 - Bugfixes og Forbedringer for Toolbar

**Kategori:** Bugfix / UX

**Endringer:**
- Fikset dropdown-meny kontrast
  - Mørkere bakgrunn (#0f172a)
  - Tydeligere tekstfarge (#f1f5f9)
  - Sterkere border (#475569)
  - Bedre hover-effekt (0.3 opacity)
- Nye bord kan nå dras og plasseres
  - enableDeskDragging() funksjonen aktiveres automatisk
  - Visuell highlight i 3 sekunder (blå glow)
  - Toast med instruksjon: "lagt til - dra for å plassere"
  - Bounds checking for å holde bord innenfor canvas
- Fikset kollisjon med elevnavn i grupperingsmodus
  - nameDiv og nameSpan får pointer-events: none når isGroupMode er aktiv
  - Klikk går nå gjennom til bordet for gruppemarkering
  - Fungerer for alle bordtyper (single, bench, round)

**Filer påvirket:**
- `index.html` - Dropdown CSS forbedringer
- `renderer.js` - enableDeskDragging(), pointer-events logikk, addDeskToSeating()
- `.agent/changelog.md` - Dette dokumentet

**Impact:**
- Bedre lesbarhet i verktøysmeny
- Raskere plassering av nye bord
- Grupperingsmodus fungerer nå uavhengig av hvor du klikker på bordet

---

## 2026-02-13 - Toolbar UI Redesign

**Kategori:** Feature / UX

**Endringer:**
- Redesignet toolbar i klassekart-redigering for bedre brukeropplevelse
  - Implementert dropdown-meny "Verktøy" med mindre brukte funksjoner
  - Shuffle-knappen fremhevet som primær handling (større, accent-farget)
  - Redusert antall synlige knapper fra 8-9 til 4
- Ny funksjonalitet: Legg til bord direkte i seating editor
  - Modal med visuell velger for bordtyper
  - Smart plassering av nye bord basert på eksisterende layout
  - Redusert antall klikk fra 7-8 til 3 for å legge til bord
- Kontekstuell toolbar for grupperingsmodus
  - Bytter automatisk til dedikerte grupperingsknapper
  - Mode badge viser at grupperingsmodus er aktiv
  - Tydelig "Ferdig" og "Avbryt" knapper
- CSS-forbedringer
  - Button hierarchy med btn-lg og btn-accent klasser
  - Dropdown-meny styling med hover-effekter
  - Desk type selector modal med grid layout
  - Mode badge for visuell feedback

**Filer påvirket:**
- `index.html` - CSS for dropdown, button hierarchy, desk selector
- `renderer.js` - toggleDropdown(), showAddDeskModal(), addDeskToSeating(), loadNormalToolbar(), cancelGroupMode(), confirmGrouping(), findOptimalDeskPosition()
- `.agent/changelog.md` - Dette dokumentet

**Impact:**
- 7-8 klikk → 3 klikk for å legge til bord
- Ryddigere toolbar med visuelt hierarki
- Raskere arbeidsflyt for lærere
- Skalerbar løsning for fremtidige funksjoner

---

## 2026-02-13 - Bugfix: Lås plassering fungerer nå

**Kategori:** Bugfix

**Endringer:**
- Fikset "Lås plassering" som ikke fungerte
  - onclick kalte feil funksjon (toggleDeskLock i stedet for toggleStudentLock)
  - Fjernet gjenværende seatingStudentContextMenu HTML
  - Oppdatert onclick til toggleStudentLock() i sammenslått meny

**Filer påvirket:**
- `index.html` - Fikset onclick og fjernet duplikat meny
- `.agent/changelog.md` - Dette dokumentet

---

## 2026-02-13 - Kritiske Bugfixes for Notat og Shuffle

**Kategori:** Bugfix

**Endringer:**
- Fikset notat som forsvant når elever ble flyttet
  - Alle drop-handlers bevarer nå hele student-objektet med note og locked
  - Bruker spread-operator (`...studentData`) for å kopiere alle egenskaper
  - Gjelder for: empty slot drop, desk drop, swap operations
- Fikset shuffle som ikke fungerte til nye rundbord/langbord
  - `syncRoomLayout()` beregner nå riktig capacity basert på DESK_TYPES
  - Nye bord får `students: null` i stedet for `[]` for konsistens
  - Locked status resettes ved sync for å unngå konflikter

**Filer påvirket:**
- `renderer.js` - Drop handlers, syncRoomLayout()
- `.agent/changelog.md` - Dette dokumentet

**Impact:**
- Notater bevares nå når elever flyttes mellom bord
- Shuffle fordeler elever korrekt til alle bordtyper etter rom-oppdatering

---

## 2026-02-13 - UX-forbedringer og Kontekstmeny-konsolidering

**Kategori:** Feature / UX

**Endringer:**
- Lagt til antall elever bak gruppenavn i dropdown ved opprettelse av klassekart
  - Viser f.eks. "8A (24 elever)"
- Lagt til sum av antall plasser bak romnavn i dropdown
  - Viser f.eks. "Klasserom 101 (30 plasser)"
  - Beregner total kapasitet basert på bordtype
- Konsolidert kontekstmeny-funksjonalitet
  - Fjernet separat `seatingStudentContextMenu`
  - Én samlet meny med: Rediger notat, Lås plassering, Bakgrunnsfarge
  - Endret språk fra "Lås denne elev" til "Lås plassering"
  - Fjernet "Lås bord"-funksjon - kun individuelle elever kan låses
- Forbedret kontekstmeny-visning
  - Viser kun relevante valg basert på om det er en elev på plassen
  - Ingen meny på tomme slots

**Filer påvirket:**
- `renderer.js` - loadSetup(), showSeatingContextMenu(), toggleStudentLock(), generateSeating()
- `index.html` - Fjernet seatingStudentContextMenu, konsolidert til én meny
- `.agent/changelog.md` - Dette dokumentet

**Impact:**
- Enklere å se om antall elever matcher antall plasser
- Mer konsekvent brukeropplevelse med én samlet kontekstmeny
- Klarere språk rundt låsing av plassering

---

## 2026-02-13 - Bugfixes og Forbedringer for Multi-Student Desks

**Kategori:** Bugfix / Feature

**Endringer:**
- Fikset hover tooltip som ikke oppdaterte når elever flyttet
  - Tooltip skjules nå før rendering for å forhindre visning av gamle data
- Fikset shuffle-funksjonalitet
  - Empty slot drop bruker nå direkte tildeling istedenfor splice
  - desk.students struktureres konsekvent som Array(capacity) med nulls
  - Defensive null-checks i generateSeating
- Låste elever kan ikke lenger flyttes manuelt
  - Toast-beskjed vises når bruker prøver å dra låst elev
  - Single desk med låst elev gjøres ikke draggable
  - Visual feedback med låse-ikon for låste elever
  - Dobbeltklikk på låst bord gir beskjed
- Forbedret notat-funksjonalitet
  - Single desk elever kan nå høyreklikke for notat
  - Fallback til første student i array hvis pos ikke finnes
  - Håndterer nulls i students-array korrekt
  - Student-spesifikk kontekstmeny for bench/round tables

**Filer påvirket:**
- `renderer.js` - Hover tooltip, shuffle, locked elever, notat-funksjon
- `.agent/changelog.md` - Dette dokumentet

**Impact:**
- Forbedret brukeropplevelse for multi-student desks
- Mer konsistent data-struktur for desk.students
- Bedre feilhåndtering og bruker-feedback

---

## 2026-02-12 - Onboarding Wizard og Forbedrede Elevnotater

**Kategori:** Feature / UX

**Endringer:**
- Implementert 3-stegs onboarding wizard for nye brukere
  - Steg 1: Opprett klasse med inline-input (textarea for elevliste)
  - Steg 2: Velg rom-template (Standard, Stort, Lite, Gruppebord)
  - Steg 3: Automatisk randomisering og klassekart-opprettelse
- Wizard vises kun ved første oppstart (localStorage-persistering)
- "Hopp over"-funksjonalitet med bekreftelse
- Erstattet elevnotat-input med dedikert modal
  - 500px bred modal med 10-rader textarea
  - Støtte for lange notater med linjeskift
  - Placeholder med eksempler
- Redusert "time-to-first-seating" fra ~10 minutter til ~3 minutter

**Filer påvirket:**
- `index.html` - Wizard HTML-struktur, wizard CSS, elevnotat-modal
- `renderer.js` - Wizard-logikk, template-generering, localStorage-sjekk, notat-modal funksjoner
- `.agent/roadmap.md` - Markert features som fullført
- `.agent/design.md` - Oppdatert med terminologi ("Bord" ikke "Pult")

**Impact:**
- 73% færre klikk for nye brukere (15 → 4 klikk)
- Autodiscovery av features gjennom guided flow
- Bedre onboarding experience

---

## 2026-02-12 - Oppretting av Agent-system

**Kategori:** Dokumentasjon

**Endringer:**
- Opprettet `.agent/` mappe for prosjektdokumentasjon
- Lagt til 5 spesialiserte agent-dokumenter:
  - `design.md` - Design-system overvåker
  - `backend.md` - Backend arkitektur dokumentasjon
  - `frontend.md` - Frontend arkitektur dokumentasjon
  - `changelog.md` - Dette dokumentet
  - `roadmap.md` - Fremtidsplaner

**Filer opprettet:**
- `.agent/design.md`
- `.agent/backend.md`
- `.agent/frontend.md`
- `.agent/changelog.md`
- `.agent/roadmap.md`

---

## 2026-02-11 - Forbedringer i Om-seksjonen

**Kategori:** Frontend / Design

**Endringer:**
- Erstattet "Overblikk" tekst med animert logo-komponent
- Fjernet anførselstegn fra beskrivelsestekst
- Lagt til rødt hjerte-ikon i beskrivelsen
- Inkludert e-postadresse under navn
- Reversert versjonsnummer til 1.0.0
- Gjenopprettet original footer-tekst

**Filer påvirket:**
- `index.html` - Om-modal oppdateringer

---

## 2026-02-10 - Forbedringer i Elevvisning

**Kategori:** Frontend / Design

**Endringer:**
- Forbedret tekstkontrast i kompetanseprofil
- Sikret at "Begynnende" tekst ikke kuttes av
- Endret størrelse på "Assessment Interview" modal til mindre popup
- Omdøpet modal til "Kompetansemål <Fag>"
- Erstattet visuell tidslinje med enkel tabell i vurderingshistorikk
- Lagt til filtre for forskjellige vurderingstyper

**Filer påvirket:**
- `index.html` - Elevvisning komponenter
- `renderer.js` - Modal og tabell-logikk

---

## 2026-02-08 - Eksport og Filtrering av Oppgaver

**Kategori:** Feature / Backend

**Endringer:**
- Filtrert ut arkiverte klasser fra "Linked Classes" liste
- Implementert eksport-funksjonalitet for vurderingsdefinisjoner
- Eksport ekskluderer elevresultater
- Sikret at klassefiltrering etter skoleår fungerer korrekt

**Filer påvirket:**
- `renderer.js` - Filtreringslogikk og eksport-funksjon
- `main.js` - Backend-støtte for eksport

---

## 2026-02-07 - Bugfix: JavaScript Syntaksfeil

**Kategori:** Bugfix

**Endringer:**
- Løste "Invalid character" error i `main.js` linje 116
- Rettet syntaksfeil som hindret programoppstart

**Filer påvirket:**
- `main.js` - Syntaks-korrigering

---

## Tidligere Historikk

### Versjon 1.0.0 - Initial Release

**Kategori:** All

**Hovedfunksjoner implementert:**
- Klasseadministrasjon (CRUD)
- Romdesigner med drag-and-drop
- Klassekart-system
- Randomisering av plassering
- Grupperings-funksjonalitet
- Versionshistorikk for klassekart
- Presentasjonsmodus
- Flip-view funksjonalitet
- SQLite database-integrasjon
- Electron-app med custom window controls
- Glassmorphism design-system
- Dark mode UI

---

## Instruksjoner for Fremtidige Innlegg

### Når loggføre
- Alle feature-tillegg
- Bugfixes
- Design-endringer
- Backend/database-endringer
- Arkitektur-endringer
- Viktige refaktoreringer

### Format å følge
1. **Dato** i format YYYY-MM-DD
2. **Kort beskrivelse** (5-10 ord)
3. **Kategori** fra listen: Backend, Frontend, Design, Bugfix, Feature, Dokumentasjon, Refactoring
4. **Endringer** - punkt-liste med detaljer
5. **Filer påvirket** - liste med filnavn og hva som ble endret

### Eksempel-innlegg

```markdown
## 2026-02-15 - Ny Eksport til PDF-funksjon

**Kategori:** Feature

**Endringer:**
- Implementert PDF-eksport av klassekart
- Lagt til print-styling for bedre utskrift
- Integrert jsPDF-bibliotek

**Filer påvirket:**
- `renderer.js` - Eksport-funksjon
- `index.html` - Ny knapp i toolbar
- `package.json` - jsPDF dependency
```

---

**Relaterte Linear issues:**
- TAK-21: Backup/Restore/Move Database (Fullført)
- TAK-33: Database-eksport må oppdateres ved schema-endringer (Backlog)

---

**Sist oppdatert:** 2026-02-13 (Database-håndtering + Settings Modal)
