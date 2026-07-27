# KlassePlass — Skole-arbeidsmåter: Implementasjonsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementere 8 nye funksjoner i KlassePlass som støtter vanlige arbeidsmåter i norsk skole, alt offline uten pålogging.

**Architecture:** Hvert feature følger eksisterende mønster: views i `src/views/`, IPC-handlers i `src/ipc-handlers.js`, bridge i `src/preload.js`, schema i `db/schema.js`. Nye features er uavhengige og kan implementeres i hvilken rekkefølge som helst.

**Tech Stack:** Electron 28, Vanilla JS ES-modules, DaisyUI v4 + Tailwind CSS, SQLite3, Font Awesome 6.

---

## Oversikt over features (prioritert rekkefølge)

| # | Feature | Kompleksitet | Verdi |
|---|---------|-------------|-------|
| 1 | Utskrift / Vikarmodus | Liten | Høy |
| 2 | Deltakelseslogg | Medium | Høy |
| 3 | Parvisning (medelevvurdering) | Liten | Høy |
| 4 | Stasjonsundervisning med tidtaker | Medium | Høy |
| 5 | Grupperotering-statistikk | Medium | Høy |
| 6 | Nivåbasert gruppering (TO) | Medium | Medium |
| 7 | Gradvis avdekking i presentasjon | Liten | Medium |
| 8 | Timeplan / Dagsoversikt | Stor | Medium |

---

## Feature 1: Utskrift / Vikarmodus

### Hva det gjør
Legger til en "Skriv ut"-knapp i seating editor og charts-dashboard som åpner en printbar HTML-side med klassekartet. Nyttig for vikarer og for å ha fysisk kopi.

### Filer som berøres
- Modify: `src/views/seating-editor.js` (legg til print-knapp i toolbar)
- Modify: `src/views/charts-dashboard.js` (legg til print-knapp per kart)
- Create: `src/styles/print.css` (print-spesifikke stiler)
- Modify: `index.html` (importer print.css)

### Task 1.1: Print CSS

Opprett `src/styles/print.css`:

```css
@media print {
  /* Skjul alt unntatt printbar innhold */
  body > #app-shell { display: none !important; }
  #print-overlay { display: block !important; }
}

#print-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: white;
  color: black;
  z-index: 9999;
  padding: 20px;
  font-family: 'Inter', sans-serif;
}

.print-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #333;
  padding-bottom: 8px;
  margin-bottom: 16px;
}

.print-chart-name {
  font-size: 22px;
  font-weight: 700;
}

.print-meta {
  font-size: 12px;
  color: #555;
}

.print-desk {
  position: absolute;
  border: 2px solid #333;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px;
  text-align: center;
  overflow: hidden;
}

.print-desk-note {
  font-size: 9px;
  font-weight: 400;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: center;
  margin-top: 1px;
}

.print-canvas-wrapper {
  position: relative;
  background: white;
  border: 1px solid #ccc;
}

.print-close-btn {
  position: fixed;
  top: 10px;
  right: 10px;
  padding: 8px 16px;
  background: #333;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  z-index: 10000;
}
@media print {
  .print-close-btn { display: none !important; }
}
```

### Task 1.2: Print overlay i index.html

I `index.html`, legg til rett etter `</div><!-- #app-shell -->`:

```html
<!-- Print overlay — vises kun ved utskrift/vikarmodus -->
<div id="print-overlay">
  <button class="print-close-btn" onclick="closePrintOverlay()">
    <i class="fa fa-xmark"></i> Lukk
  </button>
  <div class="print-header">
    <div class="print-chart-name" id="print-chart-name"></div>
    <div class="print-meta" id="print-meta"></div>
  </div>
  <div class="print-canvas-wrapper" id="print-canvas-wrapper"></div>
</div>
```

Og i `<head>`:
```html
<link rel="stylesheet" href="src/styles/print.css">
```

### Task 1.3: Print-logikk som global funksjon i renderer.js

Legg til i `src/renderer.js` (eksporter og globaliser):

```javascript
/** Åpne print-overlay med data fra et klassekart */
export function openPrintOverlay(chart) {
  const overlay = document.getElementById('print-overlay');
  const nameEl  = document.getElementById('print-chart-name');
  const metaEl  = document.getElementById('print-meta');
  const wrapper = document.getElementById('print-canvas-wrapper');
  if (!overlay || !nameEl || !metaEl || !wrapper) return;

  nameEl.textContent = chart.name ?? 'Klassekart';
  const date = new Date().toLocaleDateString('no-NO', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  metaEl.textContent = `Klasse: ${chart.className ?? ''} · Utskrift: ${date}`;

  // Bygg print-canvas
  const scale = 0.85;
  const canvasW = 900 * scale;
  const canvasH = (chart.roomHeight ?? 500) * scale;
  wrapper.style.width  = canvasW + 'px';
  wrapper.style.height = canvasH + 'px';
  wrapper.innerHTML = '';

  for (const desk of chart.desks ?? []) {
    const slot = chart.studentsById?.[desk.id];
    const name = slot?.student ?? '';
    const note = slot?.note ?? '';
    const el = document.createElement('div');
    el.className = 'print-desk';
    el.style.cssText = `left:${desk.x*scale}px;top:${desk.y*scale}px;width:${(desk.width??85)*scale}px;height:${(desk.height??55)*scale}px;`;
    el.innerHTML = `<span>${_esc(name) || '&nbsp;'}</span>` +
      (note ? `<span class="print-desk-note" title="${_esc(note)}">${_esc(note)}</span>` : '');
    wrapper.appendChild(el);
  }

  overlay.style.display = 'block';
}

function closePrintOverlay() {
  const overlay = document.getElementById('print-overlay');
  if (overlay) overlay.style.display = 'none';
}
window.closePrintOverlay = closePrintOverlay;

function _esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
```

Legg også til `window.openPrintOverlay = openPrintOverlay;` etter definisjonen.

### Task 1.4: Print-knapp i seating-editor

I `src/views/seating-editor.js`, finn toolbar-seksjonen i TEMPLATE-strengen og legg til:

```html
<button class="btn btn-sm btn-ghost" id="btn-print" title="Skriv ut / Vikarmodus">
  <i class="fa-solid fa-print"></i>
</button>
```

Og i `bindEvents()`:
```javascript
document.getElementById('btn-print')?.addEventListener('click', () => {
  if (_chart) window.openPrintOverlay(_chart);
});
```

Deretter print-knapp som åpner `window.print()`:
```javascript
// I print-overlay: legg til en "Skriv ut"-knapp
```

Oppdater `openPrintOverlay` til å inkludere en "Skriv ut"-knapp i overlay:
```html
<button onclick="window.print()" style="margin-left:8px;padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;">
  <i class="fa fa-print"></i> Skriv ut
</button>
```

### Task 1.5: Print-knapp i charts-dashboard

I `src/views/charts-dashboard.js`, legg til print-ikon per kart i kortet/listen. Når klikket, last `getSeating(id)` og `buildChartFromDb(...)`, deretter kall `window.openPrintOverlay(chart)`.

### Commit

```bash
git add src/styles/print.css src/views/seating-editor.js src/views/charts-dashboard.js src/renderer.js index.html
git commit -m "feat: legg til utskrift / vikarmodus med print-overlay"
```

---

## Feature 2: Deltakelseslogg

### Hva det gjør
Ny display-mode i seating editor: "Deltakelse". Læreren kan klikke på en pult for å registrere at eleven hadde lekse, svarte i timen, etc. Loggen lagres per økt (dato + seating_id) og kan vises som oppsummering.

### Filer som berøres
- Modify: `db/schema.js` (ny tabell `participation_logs`, schema v5)
- Modify: `src/ipc-handlers.js` (IPC for get/save/clear participation)
- Modify: `src/preload.js` (eksponér nye IPC-kall)
- Modify: `src/views/seating-editor.js` (ny mode + klikk-logikk)
- Modify: `src/shared/renderDesks.js` (støtte for deltakelse-badge)
- Modify: `src/styles/canvas.css` (deltakelse-badge stiler)

### Task 2.1: Schema — ny tabell participation_logs

I `db/schema.js`, øk `CURRENT_VERSION` til 5 og legg til i `runMigrations`:

```javascript
// ---- v5: Deltakelseslogg ----
db.run(`CREATE TABLE IF NOT EXISTS participation_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  seating_id  INTEGER NOT NULL,
  student_id  TEXT NOT NULL,
  date        TEXT NOT NULL,
  events      TEXT NOT NULL DEFAULT '[]',
  UNIQUE(seating_id, student_id, date),
  FOREIGN KEY(seating_id) REFERENCES seatings(id)
)`);
```

`events` er JSON-array: `["lekse", "svarte", "lekse"]` (tillater duplikater for å telle). Mulige event-typer:
- `"lekse"` — hadde lekse (✓)
- `"ingen-lekse"` — manglet lekse (✗)
- `"svarte"` — svarte i timen (✋)
- `"notert"` — lærer noterte noe (📝)

### Task 2.2: IPC-handlers for deltakelse

I `src/ipc-handlers.js`, legg til:

```javascript
// ---- Deltakelseslogg ----
ipcMain.handle('get-participation', async (_, seatingId, date) =>
  dbAll('SELECT * FROM participation_logs WHERE seating_id=? AND date=?', [seatingId, date]));

ipcMain.handle('save-participation', async (_, { seatingId, studentId, date, events }) => {
  const eventsJson = JSON.stringify(events ?? []);
  return dbRun(
    `INSERT INTO participation_logs (seating_id, student_id, date, events)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(seating_id, student_id, date) DO UPDATE SET events=excluded.events`,
    [seatingId, studentId, date, eventsJson]
  );
});

ipcMain.handle('get-participation-summary', async (_, seatingId) =>
  dbAll('SELECT * FROM participation_logs WHERE seating_id=? ORDER BY date DESC', [seatingId]));

ipcMain.handle('clear-participation', async (_, seatingId, date) =>
  dbRun('DELETE FROM participation_logs WHERE seating_id=? AND date=?', [seatingId, date]));
```

### Task 2.3: Preload bridge

I `src/preload.js`, legg til i `contextBridge.exposeInMainWorld`:

```javascript
// Deltakelse
getParticipation:        (sid, date) => ipcRenderer.invoke('get-participation', sid, date),
saveParticipation:       (d)         => ipcRenderer.invoke('save-participation', d),
getParticipationSummary: (sid)       => ipcRenderer.invoke('get-participation-summary', sid),
clearParticipation:      (sid, date) => ipcRenderer.invoke('clear-participation', sid, date),
```

### Task 2.4: Ny display-mode "participation" i seating-editor

I `src/views/seating-editor.js`, legg til i `DISPLAY_MODES`:

```javascript
participation: {
  label: 'Deltakelse',
  icon: 'fa-clipboard-check',
  hideNames: false, hideLocks: true, hideNotes: true, hideGroups: true
},
```

Legg til modul-state:
```javascript
let _participationData = {}; // { studentId: [events] }
let _participationDate = '';
```

I `mount()`, initialiser:
```javascript
_participationData = {};
_participationDate = new Date().toISOString().split('T')[0];
```

Ny funksjon for å laste og lagre deltakelse:
```javascript
async function loadParticipation() {
  if (!_chart?.id) return;
  const rows = await window.api.getParticipation(_chart.id, _participationDate);
  _participationData = {};
  for (const row of rows) {
    _participationData[row.student_id] = JSON.parse(row.events ?? '[]');
  }
}

async function logParticipationEvent(studentId, eventType) {
  if (!_chart?.id || !studentId) return;
  const events = _participationData[studentId] ?? [];
  events.push(eventType);
  _participationData[studentId] = events;
  await window.api.saveParticipation({
    seatingId: _chart.id,
    studentId,
    date: _participationDate,
    events,
  });
  renderParticipationBadges();
}
```

Klikk-handling i deltakelsesmodus — vis en liten popup med 4 valg:
```javascript
function handleParticipationDeskClick(deskId, event) {
  const desk = _chart.desks.find(d => d.id === deskId);
  if (!desk) return;
  const studentId = desk.slots?.[0]?.studentId ?? desk.studentId;
  if (!studentId) return;

  const menuItems = [
    { label: '✓ Hadde lekse',      value: 'lekse' },
    { label: '✗ Manglet lekse',    value: 'ingen-lekse' },
    { label: '✋ Svarte',          value: 'svarte' },
    { label: '📝 Notert',          value: 'notert' },
  ];

  // Vis en mini context-menu ved pultens posisjon
  showParticipationMenu(event.clientX, event.clientY, menuItems, (val) => {
    logParticipationEvent(studentId, val);
  });
}
```

`showParticipationMenu` er en enkel inline-dropdown (ligner eksisterende context-meny-mønster fra `src/shared/contextMenu.js`).

Oppsummering-knapp i toolbar (synlig kun i deltakelsesmodus):
```javascript
// Vis modal med oppsummering: liste av elever med teller per event-type
async function showParticipationSummary() {
  const rows = await window.api.getParticipationSummary(_chart.id);
  // Bygg HTML-tabell og vis i modal
}
```

### Task 2.5: Badge-rendering i canvas.css

I `src/styles/canvas.css`:

```css
.participation-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  justify-content: flex-end;
  pointer-events: none;
}

.part-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.part-dot-lekse       { background: #22c55e; }
.part-dot-ingen-lekse { background: #ef4444; }
.part-dot-svarte      { background: #3b82f6; }
.part-dot-notert      { background: #f59e0b; }
```

### Commit

```bash
git add db/schema.js src/ipc-handlers.js src/preload.js src/views/seating-editor.js src/styles/canvas.css
git commit -m "feat: legg til deltakelseslogg i seating editor"
```

---

## Feature 3: Parvisning (medelevvurdering)

### Hva det gjør
Ny visningsmodus "Par" i seating editor som fremhever nabosittende par visuelt, og en knapp for å se par-listen (for medelevvurdering). Bruker eksisterende `extractPairsFromLayout` fra `src/shared/utils.js`.

### Filer som berøres
- Modify: `src/views/seating-editor.js` (ny mode + overlay-rendering)
- Modify: `src/styles/canvas.css` (pair-highlight stiler)

### Task 3.1: Ny display-mode "pairs"

I `src/views/seating-editor.js`:

```javascript
pairs: {
  label: 'Par',
  icon: 'fa-handshake',
  hideNames: false, hideLocks: true, hideNotes: true, hideGroups: false
},
```

Legg til modul-state:
```javascript
let _pairMode = false; // true når _displayMode === 'pairs'
```

### Task 3.2: Par-beregning og -visning

Funksjon for å beregne nabosittende par (elever som sitter på nabodesker):

```javascript
function computeAdjacentPairs(desks, studentsById) {
  const pairs = [];
  const placed = desks.filter(d => studentsById?.[d.id]?.student);

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      // Naboer: innenfor 100px horisontalt og 80px vertikalt
      if (dx < 100 && dy < 80) {
        pairs.push({
          studentA: studentsById[a.id].student,
          studentB: studentsById[b.id].student,
          deskA: a.id,
          deskB: b.id,
        });
      }
    }
  }
  return pairs;
}
```

Funksjon for å vise par-modal:

```javascript
function showPairsModal(pairs) {
  const portal = getPortal();
  const html = `
    <div class="modal modal-open" id="pairs-modal">
      <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-4">
          <i class="fa fa-handshake mr-2 text-primary"></i>Nabosittende par (${pairs.length})
        </h3>
        <p class="text-sm opacity-60 mb-3">Disse parene egner seg for medelevvurdering.</p>
        <div class="overflow-y-auto max-h-80">
          <table class="table table-sm w-full">
            <thead><tr><th>#</th><th>Elev 1</th><th>Elev 2</th></tr></thead>
            <tbody>
              ${pairs.map((p, i) => `
                <tr>
                  <td class="text-xs opacity-50">${i + 1}</td>
                  <td>${_escHtmlSafe(p.studentA)}</td>
                  <td>${_escHtmlSafe(p.studentB)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" onclick="this.closest('.modal').remove()">Lukk</button>
        </div>
      </div>
    </div>`;
  portal.insertAdjacentHTML('beforeend', html);
}
```

Knapp i toolbar (synlig alltid, ikke bare i pairs-modus):
```javascript
document.getElementById('btn-show-pairs')?.addEventListener('click', () => {
  const pairs = computeAdjacentPairs(_chart.desks, _chart.studentsById);
  showPairsModal(pairs);
});
```

### Task 3.3: Visuell fremheving i canvas.css

```css
.desk.pair-highlight {
  outline: 3px solid #f59e0b;
  outline-offset: 2px;
}

.pair-line-overlay {
  position: absolute;
  pointer-events: none;
  top: 0; left: 0;
  width: 100%; height: 100%;
  z-index: 5;
}
```

I pairs-modus, tegn streker mellom nabosittende par via SVG overlay lagt på canvas.

### Commit

```bash
git add src/views/seating-editor.js src/styles/canvas.css
git commit -m "feat: legg til parvisning og medelevvurdering-liste"
```

---

## Feature 4: Stasjonsundervisning med tidtaker

### Hva det gjør
Nytt navigasjonspunkt "Stasjoner" i sidemenyen. Læreren setter opp antall stasjoner med navn, velger klasse, og systemet genererer en rotasjonsplan. Presentasjonsmodus viser hvilken gruppe som er på hvilken stasjon, med nedtelling.

### Filer som berøres
- Modify: `db/schema.js` (ny tabell `station_sessions`, schema v6)
- Modify: `src/ipc-handlers.js` (IPC for stasjoner)
- Modify: `src/preload.js` (eksponér nye IPC-kall)
- Create: `src/views/station-setup.js` (oppsett-wizard)
- Create: `src/views/station-presenter.js` (presentasjonsvisning med tidtaker)
- Modify: `src/renderer.js` (registrer nye views)
- Modify: `index.html` (legg til nav-item)

### Task 4.1: Schema — station_sessions

I `db/schema.js`, øk `CURRENT_VERSION` til 6:

```javascript
// ---- v6: Stasjonsundervisning ----
db.run(`CREATE TABLE IF NOT EXISTS station_sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  class_id    INTEGER NOT NULL,
  stations    TEXT NOT NULL DEFAULT '[]',
  groups      TEXT NOT NULL DEFAULT '[]',
  rotation_plan TEXT NOT NULL DEFAULT '[]',
  minutes_per_station INTEGER DEFAULT 10,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(class_id) REFERENCES classes(id)
)`);
```

- `stations`: `[{id, name}]` — stasjonsnavn
- `groups`: `[[studentId, ...], ...]` — grupper av elever
- `rotation_plan`: `[[stasjonIdx, ...], ...]` — for hvert rotasjonssteg, hvilken gruppe er på hvilken stasjon

### Task 4.2: IPC-handlers for stasjoner

```javascript
// ---- Stasjoner ----
ipcMain.handle('get-station-sessions', async (_, classId) =>
  classId
    ? dbAll('SELECT * FROM station_sessions WHERE class_id=? ORDER BY created_at DESC', [classId])
    : dbAll('SELECT * FROM station_sessions ORDER BY created_at DESC'));

ipcMain.handle('get-station-session', async (_, id) =>
  dbGet('SELECT * FROM station_sessions WHERE id=?', [id]));

ipcMain.handle('save-station-session', async (_, { id, name, classId, stations, groups, rotationPlan, minutesPerStation }) => {
  const s = JSON.stringify(stations ?? []);
  const g = JSON.stringify(groups ?? []);
  const r = JSON.stringify(rotationPlan ?? []);
  if (id) return dbRun(
    'UPDATE station_sessions SET name=?,stations=?,groups=?,rotation_plan=?,minutes_per_station=? WHERE id=?',
    [name, s, g, r, minutesPerStation ?? 10, id]);
  return dbRun(
    'INSERT INTO station_sessions (name,class_id,stations,groups,rotation_plan,minutes_per_station) VALUES (?,?,?,?,?,?)',
    [name, classId, s, g, r, minutesPerStation ?? 10]);
});

ipcMain.handle('delete-station-session', async (_, id) =>
  dbRun('DELETE FROM station_sessions WHERE id=?', [id]));
```

### Task 4.3: Preload bridge

```javascript
// Stasjoner
getStationSessions:   (cid) => ipcRenderer.invoke('get-station-sessions', cid),
getStationSession:    (id)  => ipcRenderer.invoke('get-station-session', id),
saveStationSession:   (d)   => ipcRenderer.invoke('save-station-session', d),
deleteStationSession: (id)  => ipcRenderer.invoke('delete-station-session', id),
```

### Task 4.4: station-setup.js (oppsett + dashboard)

Opprett `src/views/station-setup.js`. Viewet har to faser:

**Fase 1 — Dashboard:** Liste over lagrede stasjonssett med navn, dato, knapper for Åpne/Start/Slett.

**Fase 2 — Oppsett (modal/inline):**
- Steg 1: Gi sesjonen et navn, velg klasse, angi antall minutter per stasjon
- Steg 2: Definer stasjonsnavn (starter med 3 forslag, kan legge til/fjerne)
- Steg 3: Velg antall grupper → systemet deler elever i grupper (bruker `src/shared/groupRandomizer.js`)
- Steg 4: Vis rotasjonsplan som tabell, lagre

Rotasjonsplan-algoritme (enkel round-robin):
```javascript
function buildRotationPlan(numGroups, numStations) {
  const steps = [];
  for (let step = 0; step < numStations; step++) {
    const assignment = [];
    for (let station = 0; station < numStations; station++) {
      assignment.push((step + station) % numGroups);
    }
    steps.push(assignment);
  }
  return steps; // steps[rotasjon][stasjon] = gruppeIndeks
}
```

### Task 4.5: station-presenter.js (presentasjon + tidtaker)

Opprett `src/views/station-presenter.js`. Vises som fullskjerm-view (erstatter app-content):

```
┌─────────────────────────────────────────────┐
│  STASJONER — 8A                   10:45 ↓   │
│─────────────────────────────────────────────│
│  [Lesestasjon]   [PC-stasjon]   [Konkreti.] │
│   Gruppe 1        Gruppe 2        Gruppe 3   │
│   Ola, Kari       Petter, Anna    Siri       │
│─────────────────────────────────────────────│
│        ⏱ 07:32          [Neste →]           │
└─────────────────────────────────────────────┘
```

Tidtaker-logikk:
```javascript
let _timer = null;
let _secondsLeft = 0;

function startTimer(minutes) {
  _secondsLeft = minutes * 60;
  clearInterval(_timer);
  _timer = setInterval(() => {
    _secondsLeft--;
    updateTimerDisplay();
    if (_secondsLeft <= 0) {
      clearInterval(_timer);
      flashTimeUp();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(_secondsLeft / 60).toString().padStart(2, '0');
  const s = (_secondsLeft % 60).toString().padStart(2, '0');
  document.getElementById('station-timer').textContent = `${m}:${s}`;
}

function flashTimeUp() {
  const el = document.getElementById('station-timer');
  el?.classList.add('animate-pulse', 'text-error');
}
```

Knapp "Neste rotasjon" beveger rotasjonsindeks +1 og starter ny nedtelling. Knapp "Avslutt" returnerer til station-setup.

### Task 4.6: Registrer i renderer.js og index.html

I `src/renderer.js`:
```javascript
import { stationSetupView }     from './views/station-setup.js';
import { stationPresenterView } from './views/station-presenter.js';
// I VIEWS:
'station-setup':     stationSetupView,
'station-presenter': stationPresenterView,
// I NAV_GROUP:
'station-presenter': 'station-setup',
```

I `index.html`, etter gruppearbeid-nav-item:
```html
<div class="nav-item" data-view="station-setup" onclick="navTo('station-setup')">
  <i class="fa-solid fa-arrows-rotate nav-icon"></i> Stasjoner
</div>
```

### Commit

```bash
git add db/schema.js src/ipc-handlers.js src/preload.js src/views/station-setup.js src/views/station-presenter.js src/renderer.js index.html
git commit -m "feat: legg til stasjonsundervisning med rotasjonsplan og tidtaker"
```

---

## Feature 5: Grupperotering-statistikk

### Hva det gjør
Under "Gruppearbeid" vises en matrise over hvem som har vært i gruppe med hvem, og en knapp for å generere grupper som maksimerer nye kombinasjoner. Bruker eksisterende `group_history`-tabell og `groupRandomizer.js`.

### Filer som berøres
- Modify: `src/views/group-editor.js` (legg til statistikk-tab)
- Modify: `src/views/group-setup.js` (link til statistikk)
- Create: `src/views/group-stats.js` (statistikk-view)
- Modify: `src/shared/groupRandomizer.js` (optimaliseringsalgoritme)
- Modify: `src/renderer.js` (registrer group-stats)

### Task 5.1: group-stats.js

Opprett `src/views/group-stats.js`:

```javascript
export const groupStatsView = {
  async mount(container, params = {}) {
    const classId = params.classId;
    if (!classId) { window.navTo('group-setup'); return; }

    const cls      = await window.api.getClass(classId);
    const students = JSON.parse(cls.students ?? '[]');
    const history  = await window.api.getGroupHistory(classId, 100);

    // Bygg par-matrise: matrix[i][j] = antall ganger student i og j har vært i samme gruppe
    const names = students.map(s => s.name);
    const n = names.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));

    for (const entry of history) {
      const pairs = JSON.parse(entry.pairs ?? '[]');
      for (const [a, b] of pairs) {
        const ai = names.indexOf(a);
        const bi = names.indexOf(b);
        if (ai >= 0 && bi >= 0) {
          matrix[ai][bi]++;
          matrix[bi][ai]++;
        }
      }
    }

    container.innerHTML = buildStatsHTML(cls.name, names, matrix, classId);
    bindEvents(container, classId, names, matrix);
  },
  unmount() {},
};
```

Matrisen rendres som HTML-tabell med fargeskala:
- Grå/hvit (0 ganger) → lysegrønn (1-2) → mørkegrønn (3+)
- Celle vises som tonet firkant med `title` tooltip

```javascript
function buildStatsHTML(className, names, matrix, classId) {
  const maxVal = Math.max(...matrix.flat().filter(v => v > 0), 1);
  const cells = names.map((rowName, i) =>
    names.map((colName, j) => {
      if (i === j) return '<td class="bg-base-300 w-8 h-8"></td>';
      const val = matrix[i][j];
      const intensity = val / maxVal;
      const bg = val === 0
        ? 'oklch(var(--b2))'
        : `oklch(${0.7 - intensity*0.3} 0.15 142)`;
      return `<td class="w-8 h-8 text-center text-xs cursor-default"
        style="background:${bg};color:${val>0?'black':''};"
        title="${rowName} + ${colName}: ${val} gang(er)">${val||''}</td>`;
    }).join('')
  );

  return `
    <div class="p-6 overflow-auto h-full">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-xl font-bold">Grupperotering — ${className}</h2>
          <p class="text-sm opacity-60 mt-1">Matrisen viser antall ganger elever har vært i gruppe sammen.</p>
        </div>
        <div class="flex gap-2">
          <button id="btn-back-groups" class="btn btn-ghost btn-sm">
            <i class="fa fa-arrow-left"></i> Tilbake
          </button>
        </div>
      </div>

      <!-- Fargeskala-forklaring -->
      <div class="flex items-center gap-2 mb-4 text-xs opacity-70">
        <div class="w-4 h-4 rounded" style="background:oklch(var(--b2))"></div> Aldri
        <div class="w-4 h-4 rounded" style="background:oklch(0.65 0.15 142)"></div> 1–2 ganger
        <div class="w-4 h-4 rounded" style="background:oklch(0.4 0.15 142)"></div> 3+ ganger
      </div>

      <!-- Matrisen -->
      <div class="overflow-auto">
        <table class="border-collapse text-xs">
          <thead>
            <tr>
              <th class="w-8"></th>
              ${names.map(n => `<th class="text-xs font-normal opacity-60 pb-1 px-0"
                style="writing-mode:vertical-rl;transform:rotate(180deg);height:80px;vertical-align:bottom;">
                ${n}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${names.map((name, i) => `
              <tr>
                <td class="text-xs opacity-60 pr-2 whitespace-nowrap">${name}</td>
                ${cells[i]}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
```

### Task 5.2: Link fra group-setup

I `src/views/group-setup.js`, legg til "Se statistikk"-knapp når en klasse er valgt:

```html
<button id="btn-group-stats" class="btn btn-ghost btn-sm">
  <i class="fa fa-chart-bar"></i> Rotasjonsstatistikk
</button>
```

Navigerer til: `window.navTo('group-stats', { classId })`.

### Task 5.3: Registrer i renderer.js

```javascript
import { groupStatsView } from './views/group-stats.js';
// I VIEWS:
'group-stats': groupStatsView,
// I NAV_GROUP:
'group-stats': 'group-setup',
```

### Commit

```bash
git add src/views/group-stats.js src/views/group-setup.js src/renderer.js
git commit -m "feat: legg til grupperotering-statistikk med par-matrise"
```

---

## Feature 6: Nivåbasert gruppering (Tilpasset opplæring)

### Hva det gjør
Læreren kan merke elever med et tilpasningsnivå (1=støtte, 2=standard, 3=avansert). I gruppearbeid kan de velge å gruppere homogent (samme nivå) eller heterogent (bland nivåer). Nivået vises som farget badge på pultene i seating editor (valgfritt).

### Filer som berøres
- Modify: `src/views/classes-student-panel.js` (nivå-felt per elev)
- Modify: `src/shared/groupRandomizer.js` (støtte for nivåbasert gruppering)
- Modify: `src/views/group-setup.js` (velg grupperingsmåte)
- Modify: `src/styles/canvas.css` (nivå-badge stiler)

### Task 6.1: Nivå-felt i klasse-panelet

`students`-arrayen i `classes`-tabellen er JSON. Nivå legges til som nytt felt `level` (default `null` / ikke satt):

```json
{ "id": "uuid", "name": "Ola", "note": "", "level": null }
```

I `src/views/classes-student-panel.js`, legg til nivå-selector per elev ved siden av elevnavnet:

```html
<select class="select select-xs" data-student-level="${studentId}" title="Tilpasningsnivå">
  <option value="">—</option>
  <option value="1" ${level===1?'selected':''}>🔵 Støtte</option>
  <option value="2" ${level===2?'selected':''}>🟢 Standard</option>
  <option value="3" ${level===3?'selected':''}>🟡 Avansert</option>
</select>
```

Lagres ved `change`-event → oppdater students-array → `window.api.saveClass(...)`.

### Task 6.2: Grupperingslogikk i groupRandomizer.js

Legg til to hjelpefunksjoner i `src/shared/groupRandomizer.js`:

```javascript
/** Grupppér homogent — elever med samme nivå i samme gruppe */
export function groupByLevelHomogeneous(students, numGroups) {
  const levels = [1, 2, 3, null];
  const byLevel = {};
  for (const l of levels) byLevel[l] = students.filter(s => s.level === l);

  const groups = Array.from({ length: numGroups }, () => []);
  let gi = 0;
  for (const l of levels) {
    for (const s of byLevel[l]) {
      groups[gi % numGroups].push(s);
      gi++;
    }
  }
  return groups;
}

/** Grupppér heterogent — bland nivåer i samme gruppe */
export function groupByLevelHeterogeneous(students, numGroups) {
  const sorted = [...students].sort((a, b) => (a.level ?? 2) - (b.level ?? 2));
  const groups = Array.from({ length: numGroups }, () => []);
  sorted.forEach((s, i) => groups[i % numGroups].push(s));
  return groups;
}
```

### Task 6.3: Grupperingsvalg i group-setup.js

Legg til i oppsett-skjemaet (under eksisterende valg):

```html
<div class="form-control">
  <label class="label"><span class="label-text">Grupperingsmåte</span></label>
  <select id="grouping-mode" class="select select-bordered select-sm">
    <option value="random">Tilfeldig (standard)</option>
    <option value="homogeneous">Homogent (samme nivå)</option>
    <option value="heterogeneous">Heterogent (bland nivåer)</option>
  </select>
</div>
```

Logikken i group-setup.js bruker `groupByLevelHomogeneous` / `groupByLevelHeterogeneous` basert på valget.

### Commit

```bash
git add src/views/classes-student-panel.js src/shared/groupRandomizer.js src/views/group-setup.js src/styles/canvas.css
git commit -m "feat: legg til nivåbasert gruppering for tilpasset opplæring"
```

---

## Feature 7: Gradvis avdekking i presentasjonsmodus

### Hva det gjør
Ny "Avdekking"-modus i presentasjonsvinduet. Alle pulter starter skjult (anonym). Læreren trykker én og én for å avsløre hvem som sitter der — elevene spenner seg foran skjermen.

### Filer som berøres
- Modify: `src/views/presentation.js` (ny avdeknings-modus)
- Modify: `presentation.html` (knapper for avdekningsmodus)
- Modify: `src/styles/canvas.css` (skjult-desk stiler)

### Task 7.1: Presentasjons-state for avdekking

I `src/views/presentation.js`, legg til:

```javascript
let _revealMode   = false;  // Er vi i avdekkningsmodus?
let _revealedIds  = new Set(); // Hvilke desk-IDer er avslørt
let _revealOrder  = [];     // Tilfeldig rekkefølge å avsløre i
```

Funksjon for å starte avdekking:
```javascript
function startRevealMode() {
  _revealMode = true;
  _revealedIds.clear();
  // Lag tilfeldig rekkefølge
  const placedDesks = _chart.desks.filter(d => _chart.studentsById?.[d.id]?.student);
  _revealOrder = placedDesks.map(d => d.id).sort(() => Math.random() - 0.5);
  renderRevealMode();
}

function revealNext() {
  const nextId = _revealOrder.find(id => !_revealedIds.has(id));
  if (nextId) {
    _revealedIds.add(nextId);
    renderRevealMode();
  } else {
    // Alle avslørt
    endRevealMode();
  }
}

function revealAll() {
  _revealOrder.forEach(id => _revealedIds.add(id));
  renderRevealMode();
}

function endRevealMode() {
  _revealMode = false;
  _revealedIds.clear();
  render(); // Normal rendering
}
```

### Task 7.2: Rendering av skjulte/avslørt-pulter

I `renderRevealMode()`, kall eksisterende `renderDesks()` men med modifisert `studentsById`:

```javascript
function renderRevealMode() {
  const maskedStudents = {};
  for (const [deskId, slot] of Object.entries(_chart.studentsById ?? {})) {
    maskedStudents[deskId] = _revealedIds.has(deskId)
      ? slot
      : { ...slot, student: '?', note: '', _hidden: true };
  }
  const canvas = document.getElementById('seating-canvas');
  renderDesks(canvas, _chart.desks, maskedStudents, {
    interactive: false,
    showNames: true,
    showNumbers: false,
    showGroups: false,
  });
}
```

### Task 7.3: Knapper i presentation.html

Legg til toolbar i `presentation.html`:

```html
<div id="reveal-toolbar" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-base-200 rounded-2xl shadow-xl p-3">
  <button id="btn-reveal-next" class="btn btn-primary btn-sm">
    <i class="fa fa-eye"></i> Avslør neste
  </button>
  <button id="btn-reveal-all" class="btn btn-ghost btn-sm">
    Avslør alle
  </button>
  <button id="btn-reveal-end" class="btn btn-ghost btn-sm">
    Avslutt
  </button>
  <span id="reveal-progress" class="self-center text-sm opacity-60"></span>
</div>
```

Og en toggle-knapp i eksisterende presentasjons-toolbar:
```html
<button id="btn-reveal-mode" class="btn btn-sm btn-ghost" title="Gradvis avdekking">
  <i class="fa fa-masks-theater"></i>
</button>
```

### Commit

```bash
git add src/views/presentation.js presentation.html src/styles/canvas.css
git commit -m "feat: legg til gradvis avdekking i presentasjonsmodus"
```

---

## Feature 8: Timeplan / Dagsoversikt

### Hva det gjør
Læreren kan registrere en enkel timeplan (klasse + ukedag + time). Startsiden viser "I dag"-oversikt med planlagte klasser og sist brukte klassekart per klasse.

### Filer som berøres
- Modify: `db/schema.js` (ny tabell `schedule`, schema v7)
- Modify: `src/ipc-handlers.js`
- Modify: `src/preload.js`
- Modify: `src/views/charts-dashboard.js` (legg til "I dag"-panel øverst)
- Create: `src/views/schedule-settings.js` (timeplankonfigurasjon)
- Modify: `src/renderer.js`
- Modify: `index.html`

### Task 8.1: Schema — schedule

```javascript
// ---- v7: Timeplan ----
db.run(`CREATE TABLE IF NOT EXISTS schedule (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id  INTEGER NOT NULL,
  weekday   INTEGER NOT NULL,  -- 1=mandag, 5=fredag
  period    INTEGER NOT NULL,  -- 1=1.time, 2=2.time, ...
  note      TEXT DEFAULT '',
  FOREIGN KEY(class_id) REFERENCES classes(id)
)`);
```

### Task 8.2: IPC-handlers for timeplan

```javascript
// ---- Timeplan ----
ipcMain.handle('get-schedule', async () =>
  dbAll(`SELECT sc.*, c.name as class_name FROM schedule sc
         LEFT JOIN classes c ON sc.class_id=c.id
         ORDER BY weekday, period`));

ipcMain.handle('save-schedule-entry', async (_, { id, classId, weekday, period, note }) => {
  if (id) return dbRun('UPDATE schedule SET class_id=?,weekday=?,period=?,note=? WHERE id=?',
    [classId, weekday, period, note ?? '', id]);
  return dbRun('INSERT INTO schedule (class_id,weekday,period,note) VALUES (?,?,?,?)',
    [classId, weekday, period, note ?? '']);
});

ipcMain.handle('delete-schedule-entry', async (_, id) =>
  dbRun('DELETE FROM schedule WHERE id=?', [id]));
```

### Task 8.3: "I dag"-panel i charts-dashboard

I `src/views/charts-dashboard.js`, øverst i viewet, vis hvilke klasser som er planlagt i dag:

```javascript
async function renderTodayPanel(container) {
  const weekday = new Date().getDay(); // 0=søndag, 1=mandag...
  const schedule = await window.api.getSchedule();
  const todayEntries = schedule.filter(e => e.weekday === (weekday === 0 ? 7 : weekday));

  if (todayEntries.length === 0) return; // Ikke vis panelet hvis ingen timer i dag

  const seatings = await window.api.getSeatings();
  const seatingByClass = {};
  for (const s of seatings) {
    if (!seatingByClass[s.class_id]) seatingByClass[s.class_id] = s; // Nyeste (sortert DESC)
  }

  // Bygg "I dag"-panel HTML
  const html = `
    <div class="mb-4 p-3 bg-base-200 rounded-xl border border-base-300">
      <div class="flex items-center gap-2 mb-2">
        <i class="fa fa-calendar-day text-primary"></i>
        <span class="font-semibold text-sm">I dag</span>
      </div>
      <div class="flex flex-wrap gap-2">
        ${todayEntries.sort((a,b) => a.period-b.period).map(e => {
          const lastSeating = seatingByClass[e.class_id];
          return `
            <div class="flex items-center gap-2 bg-base-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-base-300 transition"
              onclick="${lastSeating ? `navTo('seating-editor', {chartId:${lastSeating.id}})` : `navTo('seating-setup')`}">
              <span class="text-xs opacity-50">${e.period}.</span>
              <span class="font-medium text-sm">${e.class_name}</span>
              ${lastSeating
                ? `<span class="text-xs opacity-40">${lastSeating.name}</span>`
                : `<span class="badge badge-sm badge-ghost">Nytt kart</span>`}
            </div>`;
        }).join('')}
      </div>
    </div>`;

  container.insertAdjacentHTML('afterbegin', html);
}
```

### Task 8.4: schedule-settings.js

Enkelt view for å konfigurere timeplanen. Vises som en tabell (dager × timer) der læreren klikker celler for å tildele klasser.

### Task 8.5: Registrer i renderer.js

```javascript
import { scheduleSettingsView } from './views/schedule-settings.js';
// I VIEWS: 'schedule-settings': scheduleSettingsView
// I NAV_GROUP: 'schedule-settings': 'settings'
```

Linkes fra Innstillinger-siden som en ny fane "Timeplan".

### Commit

```bash
git add db/schema.js src/ipc-handlers.js src/preload.js src/views/charts-dashboard.js src/views/schedule-settings.js src/renderer.js index.html
git commit -m "feat: legg til timeplan og dagsoversikt"
```

---

## Tekniske hensyn

### Schema-versjoner
- v5: `participation_logs`
- v6: `station_sessions`
- v7: `schedule`

Hver versjon legges til i `db/schema.js` med `CREATE TABLE IF NOT EXISTS` (idempotent).

### Ingen breaking changes
- Alle eksisterende tabeller er urørt
- Nye felt i JSON-arrays (som `level` i students) bruker `?? null` default
- `ON CONFLICT DO UPDATE` for participation-loggen sikrer upsert

### Rekkefølge for implementering
Anbefalt rekkefølge basert på uavhengighet og verdi:
1. Feature 1 (Utskrift) — ingen ny tabell, lite risiko
2. Feature 3 (Parvisning) — ingen ny tabell
3. Feature 7 (Gradvis avdekking) — ingen ny tabell
4. Feature 2 (Deltakelse) — ny tabell v5
5. Feature 5 (Statistikk) — ingen ny tabell
6. Feature 6 (Nivå) — kun JSON-felt
7. Feature 4 (Stasjoner) — ny tabell v6
8. Feature 8 (Timeplan) — ny tabell v7
