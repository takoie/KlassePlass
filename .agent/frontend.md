# Frontend Agent - KlassePlass

## Formål
Denne agenten overvåker og dokumenterer frontend-arkitekturen for KlassePlass.

> **STATUS (2026-03-04): REBUILD BESLUTTET**
> Eksisterende frontend skrives om fra scratch. Se `.agent/changelog.md` (2026-03-04) for full begrunnelse.
> Ny plan: `c:\Users\stian.TAKO\.cursor\plans\klasseplass_rebuild_1efa4c4e.plan.md`

---

## Nåværende tilstand (v1 — avvikles)

### Faktisk filstørrelse per 2026-03-04
- **index.html** — 3335 linjer (alle views + ~2000 linjer inline CSS)
- **renderer.js** — ~3000 linjer (all UI-logikk i én fil)
- **presentation.html** — separat Electron-vindu
- **modules/** — påbegynt, uferdig refaktorering (state.js, classes.js, transforms.js, onboarding.js)

### Kjente arkitekturproblemer
- Dual state: `let`-variabler i `renderer.js` + `state.js` synkronisert manuelt via `syncState()`
- Triplisert renderingslogikk (renderSeating / openChartDisplay / presentation.html)
- Dobbelt student-felt: `desk.student` (legacy) + `desk.students[]` (ny) — begge i bruk
- ROM-editor er DOM-first (leser `style.left/top`), seating-editor er data-first — motstridende paradigmer
- Kjent bug: `mainWindow` udefinert i `autoUpdater.on('update-downloaded')` — skal være `win`

### 🛠️ Stack
- **Framework:** Vanilla JavaScript (ES6+)
- **UI Library:** Bootstrap 5.3.0
- **Icons:** Font Awesome 6.4.0
- **Font:** Google Fonts (Inter)

---

## Ny arkitektur (v2 — under planlegging)

---

## Global State

### 📊 Variabler (renderer.js)

```javascript
// Dimensjoner
const DESK_W = 85;
const DESK_H = 55;
const SNAP_THRESHOLD = 15;

// State
let currentView = 'view-charts-dashboard';
let currentEditingId = null;
let currentClassId = null;
let currentRoomId = null;
let currentSeatingId = null;

// Group Mode
let isGroupMode = false;
let selectedDesksForGroup = [];
let groupCounter = 0;

// Selection State (Room Editor)
let selectedDesks = [];

// Seating Context State
let selectedSeatingDeskIdx = null;
let selectedStudentPos = null;

// Dropdown State
let activeDropdown = null;
```

### 📐 DESK_TYPES Konstant

**KRITISK**: Alle størrelser i DESK_TYPES MÅ matche CSS-reglene i `index.html`. JavaScript bruker disse verdiene til å sette inline styles som overstyrer CSS.

```javascript
const DESK_TYPES = {
    single: { width: 85, height: 55, capacity: 1, name: 'Enkeltpult' },
    round3: { width: 130, height: 130, capacity: 3, name: 'Rundbord (3)' },
    round4: { width: 145, height: 145, capacity: 4, name: 'Rundbord (4)' },
    round6: { width: 160, height: 160, capacity: 6, name: 'Rundbord (6)' },
    bench2: { width: 170, height: 55, capacity: 2, name: 'Langbord (2)' },
    bench4: { width: 340, height: 55, capacity: 4, name: 'Langbord (4)' }
};
```

**Layout-forskjeller:**
- **bench2**: Flexbox row (2 elever på rad)
- **bench4**: Flexbox row (4 elever på rad) - Endret fra 2×2 grid
- **round3**: Flex-wrap (flyter naturlig i sirkelen)
- **round4**: Flex-wrap (flyter naturlig i sirkelen)
- **round6**: CSS Grid 2×3 (2 kolonner, 3 rader for konsistent layout)

⚠️ **Viktig**: Hvis du endrer størrelse i CSS (`.desk.type-round3`), MÅ du også oppdatere DESK_TYPES i `renderer.js`!

### 🎨 Auto-Scaling for Rundbord

**Funksjon**: `applyAutoScaling(deskElement, students, deskType)`

**Filosofi** (2026-02-13): Denne funksjonen skalerer automatisk font-størrelsen på elevnavn basert **PRIMÆRT på navnelengde**, sekundært på antall elever. Dette sikrer at:
- 6 elever med korte navn (f.eks. "Mio", "Ada") → **stor tekst** ✅
- 6 elever med lange navn (f.eks. "Christopher") → **liten tekst** ✅
- 3 elever med korte navn → **stor tekst** ✅

**Algoritme:**
```javascript
// Base font sizes (økt fra før)
round3: 0.7rem, round4: 0.68rem, round6: 0.65rem

// PRIMARY: Name length scaling (viktigste faktor)
>15 tegn: × 0.70
>12 tegn: × 0.80
>10 tegn: × 0.85
>8 tegn: × 0.90
>6 tegn: × 0.95
≤6 tegn: × 1.0 (full størrelse)

// SECONDARY: Student count (kun med lange navn)
6+ elever OG >8 tegn: × 0.90
5+ elever OG >10 tegn: × 0.92

// Minimum: 0.45rem
```

**Eksempler**:
```
6 elever × 5 tegn avg:  0.65rem × 1.0           = 0.65rem (stor)
6 elever × 12 tegn avg: 0.65rem × 0.80 × 0.90   = 0.47rem (liten)
3 elever × 5 tegn avg:  0.7rem × 1.0            = 0.7rem (stor)
```

**Bruksområde:**
Kalles automatisk fra `renderSeating()` for alle rundbord etter at navn er rendret.

⚠️ **Viktig**: Ikke hardkod font-størrelse i CSS for rundbord - la `applyAutoScaling()` håndtere dette!

---

## Navigasjonssystem

### 🧭 Views

| View ID | Beskrivelse |
|---------|-------------|
| `view-charts-dashboard` | Hovedoversikt (default) |
| `view-classes` | Klasseadministrasjon |
| `view-rooms` | Romadministrasjon |
| `view-create-room` | Rom-editor |
| `view-create-seating` | Klassekart-setup |
| `view-chart-display` | Klassekart visning/redigering |

**Funksjon:**
```javascript
function navTo(view) {
  // Skjuler alle views
  // Viser aktiv view
  // Loader riktige data
}
```

---

## Hovedfunksjoner

### 📚 Klasser

| Funksjon | Beskrivelse |
|----------|-------------|
| `loadClasses()` | Laster og viser klasser i grid |
| `openClassCreate()` | Åpner "ny klasse" form |
| `editClass(id)` | Åpner redigeringsform for klasse |
| `saveClass()` | Lagrer klasse via IPC |
| `deleteClass(id)` | Sletter klasse via IPC |

### 🏠 Rom

**UI-struktur i Opprett/Rediger rom:**

**Kompakt side-ved-side layout:**

**1. Bygg klasserom (venstre):**
- Struktur dropdown: "2 - 2 (4 pulter)", "3 - 3 - 3 (9 pulter)", etc.
- Rader input (1-10)
- "Generer" knapp (hardkodet til enkeltpulter)
- "Sentrer" knapp: sentrerer alle bord
- "Tøm" knapp: fjerner alle bord

**2. Legg til bord (høyre):**
- **Inline bordtype-grid** (`.desk-type-grid-inline`):
  - 3x2 grid (3 kolonner, 2 rader)
  - 6 kompakte ikoner direkte synlige (25-42px)
  - Enkeltpult, Langbord (2/4), Rundbord (3/4/6)
  - Hover med scale (1.05x) og shadow
  - Klikk legger til bordtype direkte

**Funksjoner:**

| Funksjon | Beskrivelse |
|----------|-------------|
| `openRoomCreate()` | Initialiserer rom-editor og keyboard listeners |
| `loadRooms()` | Laster og viser rom i grid |
| `editRoom(id)` | Åpner rom i editor |
| `renderRoomCanvas(layout)` | Tegner pultene på canvas og aktiverer keyboard listeners |
| `generateLayout()` | Auto-genererer bord (alltid enkeltpulter `'single'`) basert på struktur og rader |
| `findEmptySpot(width, height)` | Finner ledig plass på canvas med grid-scanning (anti-kollisjon) |
| `addDeskOfType(type)` | Legger til spesifikk bordtype på ledig plass med toast-feedback |
| `addDesk()` | Legacy funksjon, kaller `addDeskOfType('single')` |
| `deleteSelectedDesks()` | Sletter alle markerte bord med toast-feedback |
| `attachRoomEditorKeyboardListeners()` | Legger til keyboard shortcuts (Delete, Backspace, Escape, Ctrl+A) |
| `removeRoomEditorKeyboardListeners()` | Fjerner keyboard listeners ved navigering bort |
| `centerTables()` | Sentrerer alle bord |
| `spawnDesk(x, y, container, type)` | Spawner ett bord med drag/drop og multi-select support |
| `saveRoom()` | Lagrer rom via IPC |
| `deleteRoom(id)` | Sletter rom via IPC |

**Keyboard Shortcuts (Room Editor):**
- **Shift + Click**: Legg til/fjern bord fra seleksjon
- **Ctrl/Cmd + A**: Marker alle bord
- **Delete/Backspace**: Slett markerte bord
- **Escape**: Avmarker alle bord

## ✅ Fullskjermvisning (`presentation.html`)

**Status**: Fullført og kontinuerlig forbedret (2026-02-13)

**Resultat**: Moderniserte fullskjermvisnings-modulene (`openChartDisplay()` og `presentation.html`) til å matche rendering-logikken i `renderSeating()`.

**Gjennomført**:
1. ✅ Oppdatert DESK_SPECS med korrekte størrelser fra DESK_TYPES
2. ✅ Implementert slot-basert rendering (individuelle elever, ikke kommaseparert)
3. ✅ Fjernet ikoner for notater og låste elever (skal ikke vises for elever i klasserom)
4. ✅ Lagt til høykontrast modus for projektorbruk (toggle-knapp)
5. ✅ Lagt til `applyAutoScaling()` for dynamisk font-skalering på rundbord (prioriterer navnelengde)
6. ✅ Fjernet word-break: break-word fra navn (ingen linjeskift)
7. ✅ Oppdatert print/PDF CSS for moderne bordtyper
8. ✅ **Placeholder-bokser kun på rundbord** (ikke langbord)
9. ✅ **Forbedret toolbar-layout** (CSS Grid, ingen kollisjon)

**Filer oppdatert**:
- `renderer.js` - `openChartDisplay()` funksjon (slot rendering + autoscaling)
- `presentation.html` - Rendering-logikk, CSS, høykontrast toggle, autoscaling, toolbar design
- `index.html` - Print/PDF CSS, fjernet duplikat `.lock-icon`, fikset word-break

### Placeholder-logikk (viktig!):
```javascript
// Viser "+" kun på rundbord, IKKE langbord (bench2, bench4)
if (!student) {
    if (deskType.startsWith('round')) {
        slotDiv.classList.add('bench-slot-empty');
        slotDiv.innerHTML = '<span class="bench-slot-hint">+</span>';
    }
}
// Kun append slot hvis den har student ELLER er rundbord
if (student || deskType.startsWith('round')) {
    nameContainer.appendChild(slotDiv);
}
```

### Toolbar design (CSS Grid):
- **Layout**: `grid-template-columns: 1fr auto 1fr` (ingen kollisjon)
  - Logo: venstre (`justify-self: start`)
  - Kontroller: midten (`justify-self: center`)
  - Lukk-knapp: høyre (`justify-self: end`)
- **Gradient**: `linear-gradient(135deg, #1e293b 0%, #0f172a 100%)`
- **Knapper**: Glassmorfisme (`backdrop-filter: blur(10px)`), hover-effekter (`translateY(-1px)` + box-shadow), tooltips

**Funksjoner**:
- **Høykontrast-modus**: Svart bakgrunn med hvite bord og svart tekst for optimal lesbarhet på projektor
- **Autoscaling**: Prioriterer navnelengde over antall elever (6 elever med korte navn → stor tekst)
- **Skjul tall/grupper**: Toggle-knapper (tall skjult som default)
- **Ingen linjeskift**: Navn vises på én linje med ellipsis hvis for lang
- **Print-vennlig**: Tomme plasser skjules og farger bevares ved PDF-eksport

**Konsistens**:
- Lock-ikon: `#fbbf24` (gul) for låste elever (ikke vist i fullskjerm)
- Note-ikon: `#fcd34d` (gul) for notater (ikke vist i fullskjerm)
- Samme skalering i fullskjerm som i vanlig visning

## ⚙️ Innstillinger og persistent lagring

**Settings-fil**: `%APPDATA%\Roaming\klasseplass\settings.json` (Windows)

**Implementasjon**:
- `main.js`: `loadSettings()`, `saveSettings()` funksjoner
- IPC handlers: `get-settings`, `get-setting`, `save-setting`
- `renderer.js`: Alle settings bruker `ipcRenderer.invoke()` i stedet for `localStorage`

**Tilgjengelige innstillinger**:
- `defaultFlipped` (boolean): Tavle nederst i fullskjermvisning (legacy for board-top rom)
- `onboardingCompleted` (boolean): Om onboarding wizard er fullført

**Bruk**:
```javascript
// Hent innstilling
const value = await ipcRenderer.invoke('get-setting', 'settingName');

// Lagre innstilling
await ipcRenderer.invoke('save-setting', 'settingName', value);

// Hent alle innstillinger
const settings = await ipcRenderer.invoke('get-settings');
```

---

## 🏗️ Rom Design-Modus System

**Status**: Implementert 2026-02-13

### Oversikt
Rom kan nå designes med to orienteringer:
- **`board-top`** (default/legacy): Tavle øverst, bruker CSS `rotate(180deg)` hvis `defaultFlipped` er aktivert
- **`board-bottom`** (native): Tavle nederst, ingen CSS-rotasjon nødvendig

### Database-struktur

**Ny `rooms.layout_data` format:**
```json
{
  "desks": [{"x": 100, "y": 200, "type": "single", "rotation": 0, "capacity": 1}],
  "designMode": "board-top"
}
```

**Legacy format** (automatisk konvertert):
```json
[{"x": 100, "y": 200, "type": "single", "rotation": 0, "capacity": 1}]
```

### Viewport-justering

**Smart canvas-høyde for flippet modus:**
```javascript
function adjustCanvasForFlip() {
  const maxY = Math.max(...desks.map(d => d.y + d.height));
  const flipOffset = Math.max(0, maxY - 500 + 150);
  canvas.style.setProperty('--flip-offset', flipOffset + 'px');
}
```

### Transform-funksjoner

```javascript
// Koordinat-transformasjon
function transformCoordinatesForMode(desks, fromMode, toMode) {
  if (fromMode === toMode) return desks;
  const CANVAS_H = 500;
  return desks.map(desk => ({
    ...desk,
    y: CANVAS_H - desk.y - getDeskHeight(desk.type)
  }));
}

// Format-sikring (array → object)
function ensureRoomLayoutFormat(layout) {
  if (Array.isArray(layout)) {
    return { desks: layout, designMode: 'board-top' };
  }
  return layout;
}
```

### Rendering-logikk

**Klassekart-editor:**
```javascript
if (roomDesignMode === 'board-bottom') {
  board.style.bottom = '10px';  // Native bottom
} else {
  applyDefaultFlip('seatingCanvas');  // Legacy flip
}
```

**Fullskjermvisning og PDF:**
- Henter `designMode` fra rom via IPC
- Plasserer tavle uten CSS-rotasjon for `board-bottom` rom
- Bruker `defaultFlipped` setting for `board-top` rom

---

### 🗺️ Klassekart (Seatings)

| Funksjon | Beskrivelse |
|----------|-------------|
| `loadCharts()` | Laster klassekart-oversikt (grupperte) |
| `createChart()` | Oppretter nytt klassekart |
| `editChart(id)` | Åpner klassekart for redigering |
| `renderSeating()` | Tegner klassekart med elever |
| `generateSeating(keepLocked)` | Randomiserer plassering |
| `saveChart()` | Lagrer klassekart via IPC |
| `deleteChart(id)` | Sletter klassekart via IPC |
| `openChartDisplay(id)` | Viser klassekart i fullskjerm-modus |
| `addDeskToSeating(type)` | Legger til bord direkte i seating editor |
| `showAddDeskModal()` | Viser modal for valg av bordtype |
| `findOptimalDeskPosition()` | Finner optimal plassering for nytt bord |

---

## Spesialiserte Features

### 🎯 Drag & Drop System

**Pulter (Room Editor):**
```javascript
desk.onmousedown = (e) => {
  // Starter drag
  // Beregner offset
  // Listener for mousemove/mouseup
  // Snapping logic
};
```

**Elever (Seating):**
```javascript
desk.ondragover = (e) => e.preventDefault();
desk.ondrop = (e) => {
  // Plasserer elev på pult
  // Oppdaterer dock
};
```

### 🔲 Selection System (Multi-select)

```javascript
roomContainer.onmousedown = (e) => {
  // Starter selection box
  // Oppdaterer selectedDesks array
  // Visuell feedback
};
```

**Operasjoner:**
- Delete selected: `deleteSelectedDesk()`
- Bulk operations supported

### 👥 Group Mode

**Aktivering:**
```javascript
function toggleGroupMode() {
  isGroupMode = !isGroupMode;
  // Bytter til kontekstuell toolbar
  // Viser grupperingsmodus-badge
}
```

**Workflow:**
1. Klikk pulter for å velge
2. Trykk Enter for å gruppere
3. Visuell fargekoding
4. Klikk "Ferdig" eller "Avbryt"

**Nye funksjoner:**
- `cancelGroupMode()` - Avbryter gruppering og gjenoppretter normal toolbar
- `confirmGrouping()` - Bekrefter gruppering og avslutter modus
- `loadNormalToolbar()` - Gjenoppretter standard toolbar HTML

### 🔄 Snapping Logic

```javascript
function checkSnapping(x, y, otherDesks) {
  // Sjekker nærhet til andre pulter
  // Returnerer snapped posisjoner eller null
  // SNAP_THRESHOLD = 15px
}
```

### 📦 Unplaced Students Dock

```javascript
function updateUnplacedDock() {
  // Filtrerer elever uten plass
  // Viser i dock
  // Drag-to-desk funksjonalitet
}
```

---

## Modal System

### 🪟 Modal typer

| Modal | Formål |
|-------|--------|
| `inputModal` | Generisk input (navn, kommentar, osv.) |
| `deleteModal` | Slette-bekreftelse |
| `confirmModal` | Generisk bekreftelse |
| `settingsModal` | Settings med tabs (Om, Innstillinger, Data) |
| `historyModal` | Versionshistorikk for klassekart |
| `newPeriodModal` | "Ny periode" setup |
| `studentNoteModal` | Elevnotater med textarea |

### 🎛️ Settings Modal (Tabbed)

**Struktur:**
- **Tab 1: Om KlassePlass** - Applikasjonsinformasjon, versjon, utvikler
- **Tab 2: Innstillinger** - Placeholder for fremtidige innstillinger
- **Tab 3: Data** - Database backup/restore funksjonalitet

**API:**
```javascript
openSettingsModal();         // Åpner modal (default: About tab)
closeSettingsModal();         // Lukker modal
switchTab(tabId);            // Bytter mellom tabs: 'about', 'settings', 'data'
```

**Implementering:**
- `.modal-content-large` - Større modal for tabbed content (700px)
- `.tab-navigation` - Horizontal tab buttons
- `.tab-button` - Individual tab styling with active state
- `.tab-pane` - Tab content panels (hidden by default)
- `.data-options` - Responsiv grid-layout for data-operasjonskort (auto-fit, minmax)
- `.data-option-card` - Visuelt tiltalende kort for hver database-operasjon
- Tre kort i Data-fanen: Backup (blå), Gjenopprett (rød), Flytt (oransje)
- Database path vises i Data-fanen via `get-db-path` IPC call
- Path oppdateres automatisk etter move-operasjon

**Standard modals API:**
```javascript
openModal(title, initialValue, callback);
closeModal(shouldSave);
```

---

## UI Components

### 🎴 Card Grid System
```html
<div class="card-grid">
  <div class="info-card" onclick="editClass(id)">
    <div class="card-label-small">KLASSE</div>
    <div class="card-title-large">8A</div>
    <span class="card-info-text">24 elever</span>
  </div>
</div>
```

### 🎨 Desk Rendering

```javascript
<div class="desk ${colorClass}" style="left: ${x}px; top: ${y}px;">
  <div class="desk-number">${num}</div>
  ${student ? student : ''}
  ${note ? '<i class="note-icon fas fa-sticky-note"></i>' : ''}
  ${locked ? '<i class="lock-icon fas fa-lock"></i>' : ''}
</div>
```

---

## Utilities

### 📅 Week Number
```javascript
function getWeekNumber(date) {
  // ISO week calculation
}
```

### 🔔 Toast Notifications
```javascript
function showToast(message) {
  // Viser feedback i 3 sekunder
}
```

### 🔄 Flip View
```javascript
function flipView() {
  canvas.classList.toggle('flipped');
  // Roterer 180° med CSS transform
}
```

### 💾 Database Backup/Restore/Move

```javascript
async function backupDatabase() {
  // Åpner save dialog
  // Kopierer database til valgt lokasjon
  // Viser toast-melding med resultat
  // Filnavn format: klassekart_backup_YYYY-MM-DD.db
}

async function restoreDatabase() {
  // Viser bekreftelsesdialog med advarsel
  // Åpner file dialog for .db filer
  // Gjenoppretter database fra valgt fil
  // Reloader applikasjonen etter vellykket restore
  // Viser toast-melding med resultat
}

async function moveDatabase() {
  // Viser bekreftelsesdialog med forklaring
  // Åpner folder selection dialog via backend
  // Flytter database til ny plassering
  // Viser toast med ny plassering
  // Viser restart-prompt
  // Reloader applikasjonen etter brukerbekreftelse
}
```

**Sikkerhet:**
- Restore krever bekreftelse (confirmModal)
- Move krever bekreftelse med restart-varsel
- Filstørrelse valideres på backend (max 100MB)
- Skrivetilgang testes før flytting
- Automatisk backup før restore og move
- Applikasjon reloades etter restore/move for clean state

**Use Cases for Move:**
- Flytte til ekstern harddisk for portabilitet
- Flytte til sky-synkronisert mappe (OneDrive, Dropbox) for automatisk backup
- Flytte til annen partisjon med mer plass
- Sentralisere database for organisatoriske rutiner

### 🖥️ Window Controls
```javascript
function minimizeApp() { ipcRenderer.send('app:minimize'); }
function maximizeApp() { ipcRenderer.send('app:maximize'); }
function closeApp() { ipcRenderer.send('app:close'); }
```

---

## Retningslinjer

### ✅ Best Practices
- Bruk `ipcRenderer.invoke()` for async IPC-kall
- Alltid feilhåndtering med try/catch
- Oppdater UI umiddelbart etter dataendringer
- Vis toast-feedback til bruker
- Valider input før IPC-kall
- Bruk const/let, aldri var

### ❌ Unngå
- Global pollution (bruk IIFE hvis nødvendig)
- Direkte DOM-manipulering uten state-oppdatering
- Synkrone IPC-kall
- Hardkodede magic numbers (bruk konstanter)

### ⚠️ KRITISK: Desk-Level Drop for Multi-Student Desks

**VIKTIG**: Når du dropper en elev på et multi-student desk (round/bench) via desk-level drop handler, må du ALDRI bruke `push()` eller `pop()` operasjoner. Array-lengden må alltid matche `desk.capacity`.

**KRITISK BUGFIX (2026-02-13)**: Den gamle array-reinitialiserings-logikken kunne SLETTE alle elever hvis array-lengden ikke matchet capacity!

### ✅ RIKTIG måte å legge til elev via desk-level drop:

```javascript
// Initialize students array with correct capacity
// CRITICAL: Only reset array if it's empty - NEVER overwrite existing students!
if (!desk.students) {
    desk.students = Array(capacity).fill(null);
} else if (desk.students.length !== capacity) {
    // Array length mismatch - resize WITHOUT losing existing students
    const existingStudents = desk.students.filter(s => s);
    desk.students = Array(capacity).fill(null);
    // Restore existing students to their positions
    existingStudents.forEach((student, i) => {
        if (i < capacity && student.position !== undefined && student.position < capacity) {
            desk.students[student.position] = student;
        } else if (i < capacity) {
            desk.students[i] = student;
        }
    });
}

// Find first available slot
const firstEmptySlot = desk.students.findIndex(s => !s);
if (firstEmptySlot !== -1) {
    desk.students[firstEmptySlot] = newStudent;
}
```

### ❌ FEIL måte (bryter array-struktur):

```javascript
desk.students = desk.students || [];
desk.students.push(newStudent); // ALDRI bruk push for multi-student desks!
```

**Hvorfor?**
- Multi-student desks har faste slot-posisjoner som matcher array-indekser
- Rendering-logikken itererer over `for (let pos = 0; pos < capacity; pos++)` og forventer at `students[pos]` er enten et student-objekt eller `null`
- `push()` legger til på slutten og øker lengden, noe som gjør at array-lengden ikke matcher `capacity`
- Dette fører til at elever "forsvinner" eller ikke vises, fordi rendering-logikken ikke sjekker utover `capacity`

**Hvor gjelder dette?**
- Desk-level drop handler (`d.ondrop` som ikke stoppes av `e.stopPropagation()`)
- Swap operations når desk er fullt

---

## ⚠️ KRITISK: Student Removal from Source Desk

**VIKTIG**: Når en elev fjernes fra et source desk under drag-and-drop, må du ALDRI bruke `splice()` for multi-student desks (round/bench) med faste slot-posisjoner.

### ✅ RIKTIG måte å fjerne elev:

```javascript
if (srcDesk.type === 'single') {
    srcDesk.students = [null];
    srcDesk.student = null;
} else {
    // Multi-student desk: bevare array-lengde
    srcDesk.students[srcPos] = null;
    const firstStudent = srcDesk.students.find(s => s);
    srcDesk.student = firstStudent || null;
}
```

### ❌ FEIL måte (bryter array-struktur):

```javascript
srcDesk.students.splice(srcPos, 1); // ALDRI bruk splice for multi-student desks!
```

**Hvorfor?**
- Multi-student desks (round3, round4, round6, bench2, bench4) har faste slot-posisjoner
- Array-lengden MÅ matches `desk.capacity`
- `splice()` fjerner elementet og reduserer lengden, noe som bryter slot-posisjonene
- Når slot-posisjoner er feil, kan elever "forsvinne" fordi rendering forventer spesifikke array-indekser

**Hvor gjelder dette?**
Alle drop-handlers som fjerner elever fra source desk:
- Single desk empty slot drop
- Multi-student desk slot drop
- Desk-level drop (fallback)
- Swap operations

---

## ⚠️ KRITISK: Student Data Preservation

**ALLTID bevare student-objekter ved flytting/shuffle:**
```javascript
// RIKTIG: Bevare hele objektet
const studentData = sourceDesk.students[pos];
targetDesk.students[newPos] = { ...studentData, position: newPos };

// FEIL: Opprette nytt objekt uten notater
targetDesk.students[newPos] = { name: studentName, note: '' };
```

**Ved shuffle - MUST preserve:**
- `note` - Elevnotater
- `locked` - Låst status
- Bruk studentDataMap for å holde på data under shuffle
- ALDRI reset `desk.color` ved shuffle (bevare bordfarger)

---

## Sjekkliste for nye features

- [ ] State management oppdatert
- [ ] IPC-kommunikasjon implementert
- [ ] UI feedback (loading, success, error)
- [ ] Error handling
- [ ] Konsistent med existing design
- [ ] Toast notifications
- [ ] Dokumentert i denne filen

---

## Event Listeners

### 🖱️ Globale events
```javascript
// Context menu lukking
document.addEventListener('click', (e) => {
  // Lukker context menus
});

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialisering
  navTo('view-charts-dashboard');
});
```

---

## UI Components - NEW

### 🎨 Toolbar Redesign (2026-02-13)

**Normal Mode:**
```html
<div class="editor-actions">
  <div class="btn-group">
    <button class="dropdown-toggle">Verktøy</button>
    <div class="dropdown-menu">
      <!-- Dropdown items -->
    </div>
  </div>
  <button class="btn-accent btn-lg">Shuffle</button>
  <button class="btn-primary">Lagre</button>
</div>
```

**Grouping Mode:**
```html
<div class="editor-actions mode-grouping">
  <span class="mode-badge">Grupperingsmodus aktiv</span>
  <button>Nullstill</button>
  <button>Ferdig</button>
  <button>Avbryt</button>
</div>
```

**Dropdown System:**
- `toggleDropdown(id)` - Toggler dropdown synlighet
- `activeDropdown` - Tracker åpen dropdown
- Auto-close ved klikk utenfor

**Button Hierarchy:**
- `.btn-accent` - Primær handling (Shuffle)
- `.btn-lg` - Større knapp for viktige handlinger
- `.dropdown-toggle` - Knapp med dropdown-pil

---

**Sist oppdatert:** 2026-02-13 (Toolbar redesign, inline add desk, contextual UI)

---

## Ny arkitektur (v2) — Filstruktur og regler

> Denne seksjonen beskriver målarkitekturen for rebuild. Se plan-filen for full detalj.

### Filstørrelsesregler (HÅNDHEVES)
- JS-filer: **maks 300 linjer**
- HTML view-filer: **maks 150 linjer**
- CSS-filer: **maks 200 linjer**

### Målfilstruktur
```
src/
  main.js               (< 100 linjer — kun Electron bootstrap)
  db.js                 (SQLite init, schema, queries)
  ipc-handlers.js       (alle ipcMain.handle/on)
  updater.js            (electron-updater)
  window-manager.js     (window lifecycle)
  preload.js            (contextBridge / IPC-bridge)
  store.js              (reaktiv state — én sannhetskilde, ingen duplikater)
  renderer.js           (tynn: router + event delegation, < 100 linjer)
  views/
    charts-dashboard.html + charts-dashboard.js
    seating-setup.html   + seating-setup.js
    seating-editor.html  + seating-editor.js
    room-editor.html     + room-editor.js
    classes.html         + classes.js
    settings.html        + settings.js
  shared/
    renderDesks.js       (én felles render-funksjon for editor + display + presentation)
    constraints.js       (par-regler, historikk-sjekk)
    randomize.js         (randomiser med constraint-støtte)
    animate.js           (trekk-animasjoner for presentasjon)
  styles/
    base.css             (reset, CSS custom properties for dark/light mode)
    components.css       (knapper, modaler, toast, context-menu)
    desk-types.css       (alle pultstiler)
    seating-editor.css
    room-editor.css
    presentation.css
db/
  schema.js              (schema-definisjon + migrations)
```

### Ny datamodell — desk-objekt
```javascript
// Erstatter dagens desk.student (legacy) + desk.students[] (dobbeltføring)
{
  id: 'desk-uuid',
  type: 'single',          // single | bench2 | bench4 | round3 | round4 | round6
  x: 120, y: 200,
  rotation: 0,
  color: 'default',
  groupId: null,
  slots: [{ studentId: 'uuid', locked: false }]  // null = tom plass
}
```

### Nye DB-tabeller
```sql
-- Historikk: hvilke elever satt ved siden av hverandre
CREATE TABLE seating_history (
  id INTEGER PRIMARY KEY,
  class_id INTEGER,
  chart_id INTEGER,
  created_at DATETIME,
  pairs TEXT  -- JSON: [["Ola","Kari"], ...]
);

-- Constraints: faste par og "aldri-sammen"-regler
CREATE TABLE student_constraints (
  id INTEGER PRIMARY KEY,
  class_id INTEGER,
  student_a TEXT,
  student_b TEXT,
  type TEXT  -- 'always_together' | 'never_together'
);
```

### State-prinsipp
- Én reaktiv `store.js` — ingen lokale `let`-variabler i views
- Views leser fra `store.getState()` og muterer via `store.dispatch(action)`
- Ingen `syncState()`-funksjon — dobbelt state er forbudt

**Sist oppdatert:** 2026-03-04 (Rebuild-beslutning, ny arkitektur dokumentert)
