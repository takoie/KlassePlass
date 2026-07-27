# Stasjonsmodul: ny stasjon via tab, dra-og-slipp grupper, gruppeleder — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** I `StationSetup.jsx` skal "+ Ny stasjon" ligge naturlig i tab-rekkefølgen etter siste stasjon (mellomrom legger til, fokus hopper til nytt navnefelt), elever skal flyttes mellom grupper med dra-og-slipp i stedet for en dropdown, og hver gruppe skal kunne få en manuelt utpekt gruppeleder (stjerne-ikon) som også vises i `StationPresenter` under rotasjon.

**Architecture:** Ren frontend-endring i `StationSetup.jsx` (+ liten visning i `StationPresenter.jsx`), pluss én ny DB-kolonne (`group_leaders` på `station_sessions`) og tilhørende IPC-handler-utvidelse for persistering. Dra-og-slipp bygges med det eksisterende `@dnd-kit/core`-biblioteket (samme mønster som brukes i `RoomEditor.jsx`), med to nye lokale hjelpekomponenter (`DroppableGroup`, `DraggableStudent`) definert i `StationSetup.jsx`.

**Tech Stack:** React 18, `@dnd-kit/core` (allerede installert), Electron + sql.js (`db/schema.js`, `src/ipc-handlers.js`, `src/preload.js`). Prosjektet har ingen automatisert testoppsett (ingen test-runner i `package.json`) — verifikasjon skjer ved å kjøre appen (`npm run dev`) og manuelt teste hvert steg, ikke med `pytest`/`jest`-sykluser.

**Referanse:** Design er beskrevet i `docs/plans/2026-07-27-stasjon-ny-stasjon-dnd-leder-design.md`. Les den før du starter — den forklarer *hvorfor*, denne planen forklarer *hvordan, steg for steg*.

---

### Task 1: Databasemigrasjon — `group_leaders`-kolonne

**Files:**
- Modify: `db/schema.js:6` (CURRENT_VERSION)
- Modify: `db/schema.js:136-139` (legg til v8-migrasjon)

**Step 1: Bump schema-versjon**

I `db/schema.js:6`, endre:

```js
const CURRENT_VERSION = 7;
```

til:

```js
const CURRENT_VERSION = 8;
```

**Step 2: Legg til migrasjonslinjen**

Rett etter v7-migrasjonen (`db/schema.js:138-139`, `neighbors`-kolonnen på `seating_history`), legg til en ny v8-blokk med samme mønster:

```js
      // ---- v8: Stasjon-gruppeledere — group_leaders kolonne ----
      try { db.run(`ALTER TABLE station_sessions ADD COLUMN group_leaders TEXT DEFAULT '[]'`); } catch(e){}
```

**Step 3: Verifiser manuelt**

Slett ev. lokal utviklings-DB-fil hvis du vil teste migrasjonen fra scratch (valgfritt — `ALTER TABLE` i `try/catch` er idempotent og trygg å kjøre mot en eksisterende DB uansett). Kjør appen (`npm run dev`) og bekreft at den starter uten feil i konsollen (ingen SQL-feilmeldinger om `group_leaders`).

**Step 4: Commit**

```bash
git add db/schema.js
git commit -m "feat: legg til group_leaders-kolonne på station_sessions (v8)"
```

---

### Task 2: IPC-handler — lagre og hente `group_leaders`

**Files:**
- Modify: `src/ipc-handlers.js:327-337`

**Step 1: Utvid `save-station-session`-handleren**

Nåværende kode (`src/ipc-handlers.js:327-337`):

```js
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
```

Erstatt med:

```js
  ipcMain.handle('save-station-session', async (_, { id, name, classId, stations, groups, groupLeaders, rotationPlan, minutesPerStation }) => {
    const s = JSON.stringify(stations ?? []);
    const g = JSON.stringify(groups ?? []);
    const gl = JSON.stringify(groupLeaders ?? []);
    const r = JSON.stringify(rotationPlan ?? []);
    if (id) return dbRun(
      'UPDATE station_sessions SET name=?,stations=?,groups=?,group_leaders=?,rotation_plan=?,minutes_per_station=? WHERE id=?',
      [name, s, g, gl, r, minutesPerStation ?? 10, id]);
    return dbRun(
      'INSERT INTO station_sessions (name,class_id,stations,groups,group_leaders,rotation_plan,minutes_per_station) VALUES (?,?,?,?,?,?,?)',
      [name, classId, s, g, gl, r, minutesPerStation ?? 10]);
  });
```

`get-station-session` og `get-station-sessions` bruker allerede `SELECT *`/`SELECT ss.*`, så de trenger ingen endring — `group_leaders` kommer med automatisk.

`src/preload.js:82` (`saveStationSession: (d) => ipcRenderer.invoke('save-station-session', d)`) videresender allerede hele objektet — ingen endring nødvendig der.

**Step 2: Verifiser manuelt**

Ikke testbart isolert (ingen frontend sender `groupLeaders` ennå) — verifiseres i Task 4/6.

**Step 3: Commit**

```bash
git add src/ipc-handlers.js
git commit -m "feat: lagre/hent group_leaders i save-station-session"
```

---

### Task 3: `StationSetup.jsx` — `groupLeaders`-state, last og lagre

**Files:**
- Modify: `src/components/StationSetup.jsx`

**Step 1: Legg til state**

Rett etter `const [groups, setGroups] = useState([[], []]);` (linje 33), legg til:

```js
  const [groupLeaders, setGroupLeaders] = useState([null, null]);
```

**Step 2: Last `group_leaders` i `loadInitial`**

Nåværende kode (`src/components/StationSetup.jsx:44-55`):

```js
      if (initialId && initialId !== 'new') {
        const s = await window.api.getStationSession(initialId);
        if (s) {
          setSessionId(s.id);
          setName(s.name);
          setClassId(s.class_id);
          setMinutesPerStation(s.minutes_per_station ?? 10);
          try { setStations(JSON.parse(s.stations || '[]')); } catch (e) {}
          try { setGroups(JSON.parse(s.groups || '[]')); } catch (e) {}
          await loadStudentsForClass(s.class_id);
        }
      }
```

Erstatt med:

```js
      if (initialId && initialId !== 'new') {
        const s = await window.api.getStationSession(initialId);
        if (s) {
          setSessionId(s.id);
          setName(s.name);
          setClassId(s.class_id);
          setMinutesPerStation(s.minutes_per_station ?? 10);
          try { setStations(JSON.parse(s.stations || '[]')); } catch (e) {}
          let parsedGroups = [];
          try { parsedGroups = JSON.parse(s.groups || '[]'); setGroups(parsedGroups); } catch (e) {}
          try {
            const gl = JSON.parse(s.group_leaders || '[]');
            setGroupLeaders(Array.isArray(gl) && gl.length === parsedGroups.length ? gl : parsedGroups.map(() => null));
          } catch (e) {
            setGroupLeaders(parsedGroups.map(() => null));
          }
          await loadStudentsForClass(s.class_id);
        }
      }
```

Dette dekker gamle økter lagret før migreringen (mangler `group_leaders`, eller lengden matcher ikke lenger `groups` pga. manuell DB-redigering) — de faller tilbake til en ren `null`-liste i riktig lengde i stedet for å krasje eller mismatche gruppeindekser.

**Step 3: Hold `groupLeaders` synkront i `setNumGroups`**

Nåværende kode (`src/components/StationSetup.jsx:82-89`):

```js
  const setNumGroups = (n) => {
    const target = Math.max(2, n);
    setGroups(prev => {
      const next = prev.slice(0, target);
      while (next.length < target) next.push([]);
      return next;
    });
  };
```

Erstatt med:

```js
  const setNumGroups = (n) => {
    const target = Math.max(2, n);
    setGroups(prev => {
      const next = prev.slice(0, target);
      while (next.length < target) next.push([]);
      return next;
    });
    setGroupLeaders(prev => {
      const next = prev.slice(0, target);
      while (next.length < target) next.push(null);
      return next;
    });
  };
```

**Step 4: Nullstill `groupLeaders` ved `autoDistribute`**

Nåværende kode (`src/components/StationSetup.jsx:91-101`):

```js
  const autoDistribute = () => {
    if (allStudents.length === 0) return;
    const studentsById = Object.fromEntries(allStudents.map(s => [s.id, s]));
    const result = generateGroups({
      studentIds: allStudents.map(s => s.id),
      studentsById,
      numGroups: groups.length,
      useConstraints: false,
    });
    setGroups(result.groups);
  };
```

Erstatt siste linje `setGroups(result.groups);` med:

```js
    setGroups(result.groups);
    setGroupLeaders(result.groups.map(() => null));
```

Gruppene blandes helt på nytt her, så en tidligere leder-merking ville pekt på feil elever/grupper — den nullstilles derfor i stedet for å bli stående og gi feilaktig informasjon.

**Step 5: Oppdater `moveStudent` til å nullstille leder ved utflytting**

Nåværende kode (`src/components/StationSetup.jsx:103-111`):

```js
  const moveStudent = (studentId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setGroups(prev => {
      const next = prev.map(g => [...g]);
      next[fromIdx] = next[fromIdx].filter(id => id !== studentId);
      next[toIdx] = [...next[toIdx], studentId];
      return next;
    });
  };
```

Erstatt med:

```js
  const moveStudent = (studentId, fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setGroups(prev => {
      const next = prev.map(g => [...g]);
      next[fromIdx] = next[fromIdx].filter(id => id !== studentId);
      next[toIdx] = [...next[toIdx], studentId];
      return next;
    });
    setGroupLeaders(prev => {
      if (prev[fromIdx] !== studentId) return prev;
      const next = [...prev];
      next[fromIdx] = null;
      return next;
    });
  };
```

**Step 6: Legg til `toggleLeader`**

Rett under `moveStudent`, legg til:

```js
  const toggleLeader = (groupIdx, studentId) => {
    setGroupLeaders(prev => {
      const next = [...prev];
      next[groupIdx] = next[groupIdx] === studentId ? null : studentId;
      return next;
    });
  };
```

**Step 7: Send `groupLeaders` med i `handleSave`**

Nåværende kode (`src/components/StationSetup.jsx:122-130`):

```js
      const result = await window.api.saveStationSession({
        id: sessionId,
        name: name.trim(),
        classId,
        stations: validStations,
        groups,
        rotationPlan,
        minutesPerStation,
      });
```

Erstatt med:

```js
      const result = await window.api.saveStationSession({
        id: sessionId,
        name: name.trim(),
        classId,
        stations: validStations,
        groups,
        groupLeaders,
        rotationPlan,
        minutesPerStation,
      });
```

**Step 8: Verifiser manuelt**

Kjør `npm run dev`. Opprett en ny stasjonsøkt, velg en klasse, trykk «Auto-fordel», lagre. Ingen synlig UI-endring ennå (stjerner kommer i Task 6) — bekreft bare at lagring fortsatt fungerer og at konsollen er fri for feil.

**Step 9: Commit**

```bash
git add src/components/StationSetup.jsx
git commit -m "feat: groupLeaders-state med last/lagre-støtte i StationSetup"
```

---

### Task 4: `StationSetup.jsx` — flytt "+ Ny stasjon" til bunnen med tab/mellomrom-flyt

**Files:**
- Modify: `src/components/StationSetup.jsx`

**Step 1: Legg til refs og pending-focus-state**

Rett under `const [saveState, setSaveState] = useState('idle');` (linje 34), legg til:

```js
  const nameInputRefs = useRef({});
  const [pendingFocusId, setPendingFocusId] = useState(null);
```

Oppdater import øverst i filen (linje 1) fra:

```js
import React, { useState, useEffect } from 'react';
```

til:

```js
import React, { useState, useEffect, useRef } from 'react';
```

**Step 2: Fokuser navnefeltet på nye stasjoner automatisk**

Rett etter `useEffect(() => { loadInitial(); }, [initialId]);` (linje 36), legg til:

```js
  useEffect(() => {
    if (!pendingFocusId) return;
    const el = nameInputRefs.current[pendingFocusId];
    if (el) el.focus();
    setPendingFocusId(null);
  }, [stations, pendingFocusId]);
```

**Step 3: Oppdater `addStation`**

Nåværende kode (`src/components/StationSetup.jsx:75`):

```js
  const addStation = () => setStations(prev => [...prev, { id: newStationId(), name: '', isTeacher: false, note: '' }]);
```

Erstatt med:

```js
  const addStation = () => {
    const st = { id: newStationId(), name: '', isTeacher: false, note: '' };
    setStations(prev => [...prev, st]);
    setPendingFocusId(st.id);
  };
```

**Step 4: Fjern header-knappen, legg til navnefelt-ref**

I header-raden for Stasjoner-kortet (`src/components/StationSetup.jsx:189-195`), nåværende kode:

```jsx
        <div className="bg-[#1a1e2b] border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-white">Stasjoner ({stations.length})</h3>
            <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800 gap-1" onClick={addStation}>
              <i className="fa-solid fa-plus"></i> Legg til stasjon
            </button>
          </div>
```

Erstatt med:

```jsx
        <div className="bg-[#1a1e2b] border border-slate-800 rounded-2xl p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-sm text-white">Stasjoner ({stations.length})</h3>
          </div>
```

Legg til `ref` på navne-inputen (`src/components/StationSetup.jsx:200-206`), nåværende kode:

```jsx
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => updateStation(s.id, 'name', e.target.value)}
                  placeholder="Stasjonsnavn..."
                  className="input input-bordered input-sm flex-1 bg-[#1a1e2b] border-slate-700 text-white"
                />
```

Erstatt med:

```jsx
                <input
                  type="text"
                  ref={(el) => { if (el) nameInputRefs.current[s.id] = el; else delete nameInputRefs.current[s.id]; }}
                  value={s.name}
                  onChange={(e) => updateStation(s.id, 'name', e.target.value)}
                  placeholder="Stasjonsnavn..."
                  className="input input-bordered input-sm flex-1 bg-[#1a1e2b] border-slate-700 text-white"
                />
```

**Step 5: Legg til "+ Ny stasjon"-raden nederst i listen**

Rett etter `stations.map(...)`-blokken avsluttes (`src/components/StationSetup.jsx:221-223`, `</div>` som lukker `flex flex-col gap-2`), legg til en ny knapp inni samme container, som siste barn:

```jsx
            ))}
            <button
              type="button"
              onClick={addStation}
              className="py-2 rounded-lg border-2 border-dashed border-slate-700 text-slate-400 text-xs font-bold hover:border-orange-400 hover:text-orange-300 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-plus"></i> Ny stasjon
            </button>
          </div>
        </div>
```

(Dette er samme sted som før, bare med den nye knappen lagt til som siste element inni `flex flex-col gap-2`-diven, etter `.map()`-kallet og før de to lukkende `</div>`-tagene.)

**Step 6: Verifiser manuelt**

Kjør `npm run dev`, gå til Stasjonsundervisning → ny økt. Klikk i navnefeltet på siste stasjon, trykk Tab gjentatte ganger til fokusringen når en stiplet «+ Ny stasjon»-knapp, trykk mellomrom. Bekreft at:
- en ny stasjonsrad dukker opp,
- fokus havner direkte i det nye navnefeltet (du kan skrive med en gang),
- du kan gjenta (skriv navn → tab → tab → tab → mellomrom → skriv navn...) uten å bruke mus.

**Step 7: Commit**

```bash
git add src/components/StationSetup.jsx
git commit -m "feat: flytt ny-stasjon-knapp til bunnen for tastaturvennlig tab-flyt"
```

---

### Task 5: `StationSetup.jsx` — dra-og-slipp mellom grupper

**Files:**
- Modify: `src/components/StationSetup.jsx`

**Step 1: Importer dnd-kit**

Legg til øverst i filen, under de eksisterende importene:

```js
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from '@dnd-kit/core';
```

**Step 2: Legg til to lokale hjelpekomponenter**

Rett over `export default function StationSetup(...)` (før linje 21), legg til:

```jsx
function DroppableGroup({ groupIdx, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `station-group-${groupIdx}` });
  return (
    <div ref={setNodeRef} className={`bg-[#262b3a] rounded-xl p-2.5 transition-colors ${isOver ? 'ring-2 ring-orange-400' : ''}`}>
      {children}
    </div>
  );
}

function DraggableStudent({ studentId, name, isLeader, onToggleLeader }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: studentId });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1.5 bg-[#1a1e2b] rounded px-2 py-1 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-30' : ''}`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleLeader(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0"
        title={isLeader ? 'Fjern som gruppeleder' : 'Gjør til gruppeleder'}
      >
        <i className={`fa-solid fa-star text-[11px] ${isLeader ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400/70'}`}></i>
      </button>
      <span className="text-xs text-slate-200 truncate">{name}</span>
    </div>
  );
}
```

`onPointerDown`-stopPropagation på stjerneknappen hindrer dnd-kits pointer-sensor i å tolke et klikk på stjernen som starten på en dra-operasjon.

**Step 3: Legg til sensors og drag-state i hovedkomponenten**

Rett under `const [groupLeaders, setGroupLeaders] = useState([null, null]);`, legg til:

```js
  const [activeDragId, setActiveDragId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
```

**Step 4: Legg til `handleDragEnd`**

Rett under `toggleLeader` (lagt til i Task 3, steg 6), legg til:

```js
  const handleDragEnd = (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const toIdx = Number(String(over.id).replace('station-group-', ''));
    if (Number.isNaN(toIdx)) return;
    const fromIdx = groups.findIndex(g => g.includes(active.id));
    if (fromIdx === -1) return;
    moveStudent(active.id, fromIdx, toIdx);
  };
```

**Step 5: Erstatt grupperendering med `DndContext` + dra-og-slipp**

Nåværende kode (`src/components/StationSetup.jsx:243-267`):

```jsx
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}>
            {groups.map((studentIds, idx) => (
              <div key={idx} className="bg-[#262b3a] rounded-xl p-2.5">
                <div className="text-xs font-bold text-slate-300 mb-1.5">Gruppe {idx + 1} ({studentIds.length})</div>
                <div className="flex flex-col gap-1">
                  {studentIds.map(sid => {
                    const student = studentsById[sid];
                    if (!student) return null;
                    return (
                      <div key={sid} className="flex items-center justify-between gap-1 bg-[#1a1e2b] rounded px-2 py-1">
                        <span className="text-xs text-slate-200 truncate">{student.name}</span>
                        <select
                          className="select select-bordered select-xs bg-[#262b3a] border-slate-700 text-slate-300"
                          value={idx}
                          onChange={(e) => moveStudent(sid, idx, Number(e.target.value))}
                        >
                          {groups.map((_, gi) => <option key={gi} value={gi}>{gi + 1}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
```

Erstatt med:

```jsx
          <DndContext
            sensors={sensors}
            onDragStart={(event) => setActiveDragId(event.active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(200px, 1fr))` }}>
              {groups.map((studentIds, idx) => (
                <DroppableGroup key={idx} groupIdx={idx}>
                  <div className="text-xs font-bold text-slate-300 mb-1.5">Gruppe {idx + 1} ({studentIds.length})</div>
                  <div className="flex flex-col gap-1">
                    {studentIds.map(sid => {
                      const student = studentsById[sid];
                      if (!student) return null;
                      return (
                        <DraggableStudent
                          key={sid}
                          studentId={sid}
                          name={student.name}
                          isLeader={groupLeaders[idx] === sid}
                          onToggleLeader={() => toggleLeader(idx, sid)}
                        />
                      );
                    })}
                  </div>
                </DroppableGroup>
              ))}
            </div>
            <DragOverlay>
              {activeDragId ? (
                <div className="flex items-center gap-1.5 bg-[#1a1e2b] border border-orange-400 rounded px-2 py-1 shadow-lg">
                  <i className="fa-solid fa-star text-[11px] text-transparent"></i>
                  <span className="text-xs text-slate-200">{studentsById[activeDragId]?.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
```

Merk: `<select>`-elementet og dets `onChange`-håndtering er fullstendig fjernet — flytting skjer nå kun via dra-og-slipp. Stjerne-toggling (`onToggleLeader`) er koblet inn i `DraggableStudent` fra Task 3, steg 6.

**Step 6: Verifiser manuelt**

Kjør `npm run dev`. Med en klasse valgt og elever auto-fordelt:
- Dra et elevkort fra én gruppe til en annen — bekreft at kortet flyttes, og at mål-gruppen får en oransje ring mens du drar over den.
- Klikk stjernen på en elev — bekreft at eleven blir markert som leder (gul stjerne), og at klikket *ikke* starter en dra-operasjon.
- Klikk stjernen på en annen elev i samme gruppe — bekreft at lederstatusen flyttes (kun én leder per gruppe).
- Dra lederen til en annen gruppe — bekreft at lederstatusen nullstilles i den gamle gruppen (og at ny gruppe ikke automatisk arver den).
- Trykk «Auto-fordel» — bekreft at alle ledere nullstilles.

**Step 7: Commit**

```bash
git add src/components/StationSetup.jsx
git commit -m "feat: dra-og-slipp mellom grupper + gruppeleder-stjerne i StationSetup"
```

---

### Task 6: `StationPresenter.jsx` — vis gruppeleder under rotasjon

**Files:**
- Modify: `src/components/StationPresenter.jsx`

**Step 1: Parse `group_leaders` i `load()`**

Nåværende kode (`src/components/StationPresenter.jsx:23-26`):

```js
      let stations = [], groups = [], rotationPlan = [];
      try { stations = JSON.parse(s.stations || '[]'); } catch (e) {}
      try { groups = JSON.parse(s.groups || '[]'); } catch (e) {}
      try { rotationPlan = JSON.parse(s.rotation_plan || '[]'); } catch (e) {}
```

Erstatt med:

```js
      let stations = [], groups = [], groupLeaders = [], rotationPlan = [];
      try { stations = JSON.parse(s.stations || '[]'); } catch (e) {}
      try { groups = JSON.parse(s.groups || '[]'); } catch (e) {}
      try { groupLeaders = JSON.parse(s.group_leaders || '[]'); } catch (e) {}
      try { rotationPlan = JSON.parse(s.rotation_plan || '[]'); } catch (e) {}
```

Og litt lenger ned (`src/components/StationPresenter.jsx:36`):

```js
      setSession({ ...s, stations, groups, rotationPlan, className: cls?.name || '' });
```

Erstatt med:

```js
      setSession({ ...s, stations, groups, groupLeaders, rotationPlan, className: cls?.name || '' });
```

**Step 2: Vis stjerne ved lederens navn**

Nåværende kode (`src/components/StationPresenter.jsx:122-125`):

```jsx
                <div className="bg-[#171a25] p-3 flex flex-col gap-1 min-h-[60px]">
                  {studentIds.map(sid => (
                    <span key={sid} className="text-sm text-slate-200">{studentsById[sid]?.name || sid}</span>
                  ))}
```

Erstatt med:

```jsx
                <div className="bg-[#171a25] p-3 flex flex-col gap-1 min-h-[60px]">
                  {studentIds.map(sid => {
                    const isLeader = typeof groupIdx === 'number' && (session.groupLeaders || [])[groupIdx] === sid;
                    return (
                      <span key={sid} className="text-sm text-slate-200 flex items-center gap-1.5">
                        {isLeader && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
                        {studentsById[sid]?.name || sid}
                      </span>
                    );
                  })}
```

(`groupIdx` er allerede definert like over i samme `.map()`-blokk, se `src/components/StationPresenter.jsx:106-108`.)

**Step 3: Verifiser manuelt**

I StationSetup, sett en gruppeleder for minst én gruppe og lagre. Trykk «Start økt». Bekreft at lederen vises med en liten gul stjerne foran navnet sitt i riktig stasjon, og at stjernen følger med riktig når du bytter rotasjon («Neste rotasjon»/«Forrige»).

**Step 4: Commit**

```bash
git add src/components/StationPresenter.jsx
git commit -m "feat: vis gruppeleder-stjerne i StationPresenter"
```

---

### Task 7: Sluttverifisering (full manuell gjennomgang)

**Files:** Ingen kodeendringer — kun verifikasjon.

**Step 1: Full flyt fra bunnen av**

Kjør `npm run dev` og gå gjennom hele flyten i `docs/plans/2026-07-27-stasjon-ny-stasjon-dnd-leder-design.md`, seksjon "Testing":

1. Opprett en ny stasjonsøkt, legg til 4-5 stasjoner kun med tastatur (tab til «+ Ny stasjon», mellomrom, skriv navn, gjenta).
2. Velg klasse, «Auto-fordel», dra minst to elever mellom grupper.
3. Sett gruppeleder i to grupper, flytt en av lederne til en annen gruppe og bekreft at lederstatus nullstilles.
4. Lagre. Naviger bort (Tilbake) og inn igjen (rediger samme økt) — bekreft at grupper og lederstatus overlever reload.
5. Åpne en *eksisterende* stasjonsøkt opprettet før denne endringen (hvis noen finnes i dev-databasen) — bekreft at den laster uten feil og viser ingen ledere (fallback fungerer).
6. Trykk «Start økt» og bla gjennom alle rotasjoner — bekreft at lederstjernen vises konsekvent.

**Step 2: Commit (kun hvis noe måtte rettes)**

Hvis sluttverifiseringen avdekker feil, rett dem i riktig fils commit fra tidligere task (ikke en egen "fix"-commit på toppen) — men hvis planen allerede er fullført og pushet, lag en liten oppfølgingscommit:

```bash
git add -A
git commit -m "fix: <beskrivelse av det som ble rettet i sluttverifisering>"
```
