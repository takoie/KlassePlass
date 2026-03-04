# KlassePlass v2 — Rebuild Design Document

**Dato:** 2026-03-04  
**Status:** Godkjent — under implementering  
**Branch:** `feature/rebuild-v2`

---

## 1. Bakgrunn og beslutning

KlassePlass v1 ble bygget inkrementelt og har akkumulert teknisk gjeld:

- `renderer.js` (~3000 linjer) og `index.html` (~3335 linjer) er for store til å vedlikeholde trygt
- Renderingslogikk er triplisert (editor / display / presentation window)
- Dual state-system: `let`-variabler i `renderer.js` + `state.js` synkronisert manuelt
- Legacy `desk.student` og `desk.students[]` lever side om side
- Kjent bug: `mainWindow` udefinert i auto-updater handler (skal være `win`)

Beslutning: **Skriv fra scratch** med ren arkitektur. Behold Electron + SQLite + designspråk.

---

## 2. Nye krav (utover v1-funksjonalitet)

| Funksjon | Beskrivelse |
|---|---|
| Faste elevpar | Constraint: alltid sitte sammen |
| Aldri-sammen | Constraint: aldri sitte ved siden av hverandre |
| Historikk-constraints | Unngå par fra siste X kart |
| Trekk-animasjoner | Morsomme randomiseringsanimasjoner på projektor |
| Romdekorasjoner | Tegne inn skillevegger, skap, vinduer, dører |
| Dark/light mode | CSS custom properties, toggle i settings |
| JSON eksport/import | Klasse + alle kart + historikk som én bundle |
| Historikk-visning | Timeline og par-matrise per klasse |
| Auto-oppdatering | Fiks eksisterende GitHub-updater infrastruktur |

---

## 3. Arkitektur

### 3.1 Filstørrelsesregler (ikke forhandlingsbart)

| Type | Maks linjer |
|---|---|
| JavaScript | 300 |
| HTML (view) | 150 |
| CSS | 200 |

### 3.2 Prosessarkitektur

```
Electron Main Process
  main.js            (bootstrap: < 100 linjer)
  window-manager.js  (vindu-oppretting og lifecycle)
  ipc-handlers.js    (alle ipcMain.handle/on)
  db.js              (SQLite init, schema, queries)
  updater.js         (electron-updater)

Renderer Process (index.html)
  preload.js         (contextBridge — eksponerer kun window.api)
  renderer.js        (tynn router: < 100 linjer)
  store.js           (reaktiv state — én sannhetskilde)
  views/             (én JS + HTML per view)
  shared/            (delt logikk)
  styles/            (CSS per komponent/view)

Presentation Window (presentation.html)
  presentation.js    (fullscreen rendering + animasjoner)
```

### 3.3 View-routing

`renderer.js` er en tynn router. Views lastes dynamisk:

```javascript
// renderer.js — tynn router
import { chartsView } from './views/charts-dashboard.js';
import { seatingEditorView } from './views/seating-editor.js';
// ...

const routes = {
  'charts-dashboard': chartsView,
  'seating-editor': seatingEditorView,
  // ...
};

function navTo(viewName, params = {}) {
  routes[viewName].mount(document.getElementById('app'), params);
}
```

Hvert view-modul eksporterer `{ mount, unmount }`.

### 3.4 State store

Enkelt reaktivt store uten tredjeparts bibliotek:

```javascript
// store.js
const listeners = new Set();
let _state = { /* initial state */ };

export const store = {
  getState: () => ({ ..._state }),
  setState: (patch) => {
    _state = { ..._state, ...patch };
    listeners.forEach(fn => fn(_state));
  },
  subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }
};
```

Views abonnerer på relevante deler av state. Ingen `syncState()`, ingen duplikater.

### 3.5 IPC-bridge (preload.js)

```javascript
// preload.js — contextBridge
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getClasses:      ()        => ipcRenderer.invoke('get-classes'),
  saveClass:       (data)    => ipcRenderer.invoke('save-class', data),
  getRooms:        ()        => ipcRenderer.invoke('get-rooms'),
  saveRoom:        (data)    => ipcRenderer.invoke('save-room', data),
  getSeatings:     (classId) => ipcRenderer.invoke('get-seatings', classId),
  saveSeating:     (data)    => ipcRenderer.invoke('save-seating', data),
  deleteSeating:   (id)      => ipcRenderer.invoke('delete-seating', id),
  getConstraints:  (classId) => ipcRenderer.invoke('get-constraints', classId),
  saveConstraint:  (data)    => ipcRenderer.invoke('save-constraint', data),
  deleteConstraint:(id)      => ipcRenderer.invoke('delete-constraint', id),
  getHistory:      (classId) => ipcRenderer.invoke('get-history', classId),
  exportBundle:    (classId) => ipcRenderer.invoke('export-bundle', classId),
  importBundle:    (data)    => ipcRenderer.invoke('import-bundle', data),
  openPresentation:(data)    => ipcRenderer.send('open-presentation', data),
  onUpdateReady:   (cb)      => ipcRenderer.on('update-ready', (_, info) => cb(info)),
  restartApp:      ()        => ipcRenderer.send('restart-app'),
  getSettings:     ()        => ipcRenderer.invoke('get-settings'),
  saveSettings:    (data)    => ipcRenderer.invoke('save-settings', data),
  backupDb:        ()        => ipcRenderer.invoke('backup-db'),
  restoreDb:       ()        => ipcRenderer.invoke('restore-db'),
});
```

---

## 4. Datamodell

### 4.1 Desk-objekt (ny, ren)

```javascript
{
  id: 'desk-uuid',          // Stabil identitet (uuid v4 eller crypto.randomUUID())
  type: 'single',           // single | bench2 | bench4 | round3 | round4 | round6
  x: 120,                   // piksler fra venstre
  y: 200,                   // piksler fra topp
  rotation: 0,              // 0 | 90 | 180 | 270
  color: 'default',         // default | red | green | blue | yellow | purple
  groupId: null,            // integer eller null
  slots: [                  // array, lengde = desk type capacity
    { studentId: 'uuid', locked: false },  // null = tom plass
    null
  ]
}
```

Erstatter: `desk.student` (legacy) + `desk.students[]` + dobbeltføring.

### 4.2 Student-objekt (separat, referert via ID)

```javascript
{
  id: 'student-uuid',
  name: 'Ola Nordmann',
  note: ''
}
```

Students lagres i `class.students[]` og refereres kun med ID i desk-slots.

### 4.3 Chart-objekt (i minnet under redigering)

```javascript
{
  id: null,                  // null = ulagret
  name: 'Klasse 1A — uke 10',
  classId: 5,
  roomId: 3,
  layout: [ /* desk-objekter med slots */ ],
  roomDesignMode: 'board-top',
  roomHeight: 500,
  flipForDisplay: false,
  avoidLastN: 3,             // historikk-constraint: unngå par fra siste 3 kart
  createdAt: null
}
```

### 4.4 Decoration-objekt (romdekorasjoner)

```javascript
{
  id: 'deco-uuid',
  type: 'wall',             // wall | cabinet | window | door | label
  x: 50, y: 100,
  width: 200, height: 20,
  rotation: 0,
  label: ''                 // kun for type 'label'
}
```

---

## 5. Database-skjema

### 5.1 Eksisterende tabeller (beholdes, bakoverkompatible)

```sql
-- Klasser
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  students TEXT  -- JSON array of student names (legacy strings)
);

-- Rom
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  layout_data TEXT  -- JSON: { desks, designMode, roomHeight, decorations }
);

-- Klassekart
CREATE TABLE IF NOT EXISTS seatings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  class_id INTEGER,
  room_id INTEGER,
  layout_data TEXT,  -- JSON: desk-objekter med slots
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(class_id) REFERENCES classes(id),
  FOREIGN KEY(room_id) REFERENCES rooms(id)
);
```

### 5.2 Nye tabeller (migreres inn)

```sql
-- Historikk: hvilke elever satt ved siden av hverandre
CREATE TABLE IF NOT EXISTS seating_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  chart_id INTEGER,
  pairs TEXT NOT NULL,       -- JSON: [["Ola","Kari"], ["Per","Lise"]]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(class_id) REFERENCES classes(id),
  FOREIGN KEY(chart_id) REFERENCES seatings(id)
);

-- Constraints: faste par og aldri-sammen regler
CREATE TABLE IF NOT EXISTS student_constraints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  student_a TEXT NOT NULL,
  student_b TEXT NOT NULL,
  type TEXT NOT NULL,        -- 'always_together' | 'never_together'
  FOREIGN KEY(class_id) REFERENCES classes(id)
);

-- Schema-versjonering
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Rendering-arkitektur

### 6.1 Felles render-funksjon

```javascript
// shared/renderDesks.js
export function renderDesks(container, desks, students, options = {}) {
  const {
    interactive = false,      // drag-and-drop handlers
    showNames = true,
    showNumbers = false,
    showGroups = false,
    coordinateTransform = null,  // fn(desk) => { x, y }
    onDeskClick = null,
    onStudentDrop = null,
  } = options;

  container.innerHTML = '';
  const transformed = coordinateTransform
    ? desks.map(d => ({ ...d, ...coordinateTransform(d) }))
    : desks;

  transformed.forEach(desk => {
    const el = createDeskElement(desk, students, options);
    container.appendChild(el);
  });
}
```

Brukes av: `seating-editor.js`, `seating-display.js`, `presentation.js`.

### 6.2 Koordinat-transformasjon

```javascript
// shared/transforms.js
export function flipCoordinates(desks, roomHeight, canvasWidth) {
  return desks.map(desk => {
    const { width, height } = DESK_TYPES[desk.type];
    return {
      ...desk,
      x: canvasWidth - desk.x - width,
      y: roomHeight - desk.y - height,
      rotation: (desk.rotation + 180) % 360
    };
  });
}
```

---

## 7. Constraint- og randomiser-arkitektur

### 7.1 Constraint-typer

```javascript
// Hard constraints — blokkerer
{ type: 'always_together', studentA: 'Ola', studentB: 'Kari' }
{ type: 'never_together',  studentA: 'Per', studentB: 'Lise' }

// Soft constraints — advarer, forsøkes overholdt
{ type: 'history_avoid', studentA: 'Ola', studentB: 'Kari', strength: 0.8 }
```

### 7.2 Randomiser-algoritme

```
1. Last hard constraints (alltid/aldri) fra DB
2. Last historikk for siste N kart, bygg soft constraints
3. Forsøk shuffling (maks 100 iterasjoner):
   a. Fisher-Yates shuffle av students
   b. Assign til ledige desk-slots
   c. Evaluer: alle hard constraints oppfylt?
   d. Evaluer: soft constraint score (lavere = færre gjentatte par)
   e. Behold beste løsning
4. Returner layout + constraint-rapport (hvilke som evt. brytes)
```

---

## 8. Animasjons-arkitektur

### 8.1 Trekk-modus

Kjøres i presentation window:

1. Vis alle pulter tomme
2. "Trekk"-sekvens: én elev om gangen "flyr" til sin plass
   - Elev-kort dukker opp midt på skjermen
   - Animeres med CSS `transition` til pultens posisjon
   - Lyd-trigger (valgfritt)
3. Lærer kontrollerer tempo fra hoved-vindu (neste / pause / vis alle)

IPC-meldinger: `presentation-next-student`, `presentation-show-all`, `presentation-reset`.

---

## 9. Migreringsstrategi

1. `db.js` kjører schema-migrations ved hver oppstart
2. Eksisterende `classes`, `rooms`, `seatings` tabeller røres ikke
3. Nye tabeller opprettes via `CREATE TABLE IF NOT EXISTS`
4. `layout_data` JSON i `seatings` er bakoverkompatibel (ny kode håndterer både gammelt og nytt format)
5. `seating_history` populeres første gang et nytt kart lagres i v2

---

## 10. Byggerekkefølge

Se `.cursor/plans/klasseplass_rebuild_1efa4c4e.plan.md` for detaljert todo-liste.

Overordnet rekkefølge:
1. ~~Agent-dokumentasjon~~ (fullført)
2. Dette design-dokumentet (fullført)
3. Ny filstruktur + `store.js` + `renderDesks.js`
4. `main.js` splittes til `db.js`, `ipc-handlers.js`, `updater.js`, `window-manager.js`
5. DB-schema med migrations
6. Views én etter én
7. Constraint-motor + ny randomiser
8. Historikk
9. Animasjoner + presentasjonsvindu
10. Romdekorasjoner
11. Dark/light mode, eksport/import, polish
