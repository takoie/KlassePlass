# Frontend Agent - KlassePlass

## Formål
Denne agenten overvåker og dokumenterer frontend-arkitekturen for KlassePlass.

---

## Arkitektur

### 📂 Filstruktur
- **index.html** (1384 linjer) - Hovedgrensesnitt
- **renderer.js** (1167 linjer) - Frontend-logikk
- **presentation.html** - Presentasjonsvindu

### 🛠️ Stack
- **Framework:** Vanilla JavaScript (ES6+)
- **UI Library:** Bootstrap 5.3.0
- **Icons:** Font Awesome 6.4.0
- **Font:** Google Fonts (Inter)

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
```

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

| Funksjon | Beskrivelse |
|----------|-------------|
| `openRoomCreate()` | Initialiserer rom-editor |
| `loadRooms()` | Laster og viser rom i grid |
| `editRoom(id)` | Åpner rom i editor |
| `renderRoomCanvas(layout)` | Tegner pultene på canvas |
| `generateLayout()` | Auto-genererer pulter (rows/cols) |
| `centerTables()` | Sentrerer alle pulter |
| `spawnDesk(x, y, container)` | Spawner én pult med drag/drop |
| `saveRoom()` | Lagrer rom via IPC |
| `deleteRoom(id)` | Sletter rom via IPC |

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
  // UI feedback
}
```

**Workflow:**
1. Klikk pulter for å velge
2. Trykk Enter for å gruppere
3. Visuell fargekoding

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
| `aboutModal` | Om-applikasjon info |
| `historyModal` | Versionshistorikk for klassekart |
| `newPeriodModal` | "Ny periode" setup |

**API:**
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

**Sist oppdatert:** 2026-02-12
