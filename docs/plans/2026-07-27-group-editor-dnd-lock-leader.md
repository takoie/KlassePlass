# Gruppeeditor: dra-og-slipp + lås/gruppeleder-meny — Implementasjonsplan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Erstatt dropdown-basert gruppeflytting i `GroupEditor.jsx` med dra-og-slipp, og
legg til en høyreklikk-meny på elevkort for å utpeke gruppeleder og låse elever mot
randomisering ved «Generer på nytt».

**Architecture:** Ny DB-kolonne `locked_ids` på `group_assignments` (skjema v8) lagrer
låste elev-IDer. `GroupEditor.jsx` bygger `lockedPlacements` fra denne lista og elevenes
nåværende gruppeindeks før den kaller den allerede eksisterende (men til nå ubrukte)
`lockedPlacements`-parameteren i `groupRandomizer.js`. Dra-og-slipp bruker `@dnd-kit/core`
(allerede en avhengighet, brukt i `RoomEditor.jsx`) med `DndContext` + `useDraggable` per
elevkort + `useDroppable` per gruppepanel. En ny `StudentContextMenu.jsx` følger samme
mønster som eksisterende `SeatingChart/DeskContextMenu.jsx`.

**Tech Stack:** React (Electron renderer), `@dnd-kit/core`/`@dnd-kit/utilities`, sql.js
(via `src/ipc-handlers.js`), Tailwind utility-klasser (prosjektets gjennomgående stil —
ingen CSS-moduler brukes i `GroupEditor.jsx` per i dag).

**Merk om testing:** Dette prosjektet har ingen automatisk test-runner konfigurert
(`package.json` har verken `jest`, `vitest` eller en `test`-script). Det er en Electron +
React desktop-app uten eksisterende testinfrastruktur. Å innføre en hel testoppsett er
utenfor scope for denne oppgaven (YAGNI). Verifikasjon skjer derfor per steg via
statiske sjekker (grep/node-syntaks-sjekk) og avsluttes med en manuell
gjennom-testing av hele flyten i den kjørende appen (Task 8, via `run`-skillet).

---

### Task 1: Databasemigrasjon — `locked_ids`-kolonne

**Files:**
- Modify: `db/schema.js`

**Step 1: Legg til v8-migrasjon**

I `db/schema.js`, rett under v7-blokken (linje 138–139: nabo-historikk-migrasjonen), legg til:

```js
      // ---- v8: Låste elever i gruppearbeid — locked_ids kolonne ----
      try { db.run(`ALTER TABLE group_assignments ADD COLUMN locked_ids TEXT DEFAULT '[]'`); } catch(e){}
```

Og bump versjonstallet øverst i filen:

```js
const CURRENT_VERSION = 8;
```

**Step 2: Verifiser syntaks**

Run: `node -e "require('./db/schema.js')"`
Expected: Ingen output, exit code 0 (bekrefter at filen fortsatt er gyldig JS og
`runMigrations`/`CURRENT_VERSION` eksporteres som før).

**Step 3: Commit**

```bash
git add db/schema.js
git commit -m "feat: legg til locked_ids-kolonne for gruppearbeid (skjema v8)"
```

---

### Task 2: IPC-handler — lagre og hente `lockedIds`

**Files:**
- Modify: `src/ipc-handlers.js:160-178`

**Step 1: Utvid `save-group-assignment`-handleren**

Nåværende kode (linje 160–178):

```js
  ipcMain.handle('save-group-assignment', async (_, { id, name, classId, sourceSeatingId, useConstraints, avoidLastN, requireLeaders, leaderIds, groups }) => {
    const lids = JSON.stringify(leaderIds ?? []);
    let assignmentId = id;
    if (id) {
      await dbRun('UPDATE group_assignments SET name=?,use_constraints=?,avoid_last_n=?,require_leaders=?,leader_ids=? WHERE id=?',
        [name, useConstraints ? 1 : 0, avoidLastN, requireLeaders ? 1 : 0, lids, id]);
      await dbRun('DELETE FROM group_assignment_groups WHERE assignment_id=?', [id]);
    } else {
      const r = await dbRun(
        'INSERT INTO group_assignments (name,class_id,source_seating_id,use_constraints,avoid_last_n,require_leaders,leader_ids) VALUES (?,?,?,?,?,?,?)',
        [name, classId, sourceSeatingId ?? null, useConstraints ? 1 : 0, avoidLastN, requireLeaders ? 1 : 0, lids]);
      assignmentId = r.lastID;
    }
```

Erstatt med:

```js
  ipcMain.handle('save-group-assignment', async (_, { id, name, classId, sourceSeatingId, useConstraints, avoidLastN, requireLeaders, leaderIds, lockedIds, groups }) => {
    const lids = JSON.stringify(leaderIds ?? []);
    const lockIds = JSON.stringify(lockedIds ?? []);
    let assignmentId = id;
    if (id) {
      await dbRun('UPDATE group_assignments SET name=?,use_constraints=?,avoid_last_n=?,require_leaders=?,leader_ids=?,locked_ids=? WHERE id=?',
        [name, useConstraints ? 1 : 0, avoidLastN, requireLeaders ? 1 : 0, lids, lockIds, id]);
      await dbRun('DELETE FROM group_assignment_groups WHERE assignment_id=?', [id]);
    } else {
      const r = await dbRun(
        'INSERT INTO group_assignments (name,class_id,source_seating_id,use_constraints,avoid_last_n,require_leaders,leader_ids,locked_ids) VALUES (?,?,?,?,?,?,?,?)',
        [name, classId, sourceSeatingId ?? null, useConstraints ? 1 : 0, avoidLastN, requireLeaders ? 1 : 0, lids, lockIds]);
      assignmentId = r.lastID;
    }
```

(`get-group-assignment` gjør allerede `SELECT * FROM group_assignments WHERE id=?` —
`locked_ids` kommer med automatisk, ingen endring nødvendig der. `preload.js` sender
allerede hele objektet til `save-group-assignment`, så `lockedIds` når fram uten
endringer i `src/preload.js`.)

**Step 2: Verifiser syntaks**

Run: `node -e "require('./src/ipc-handlers.js')"`
Expected: Feiler med `Cannot find module 'electron'` (forventet — filen kan ikke kjøres
utenfor Electron), IKKE en `SyntaxError`. En `SyntaxError` betyr en skrivefeil i patchen.

**Step 3: Commit**

```bash
git add src/ipc-handlers.js
git commit -m "feat: persister lockedIds i save-group-assignment"
```

---

### Task 3: GroupEditor.jsx — state og handlers for lås og gruppeleder

**Files:**
- Modify: `src/components/GroupEditor.jsx`

**Step 1: Legg til `lockedIds`- og `contextMenu`-state**

Etter linje 16 (`const [leaderIds, setLeaderIds] = useState([]);`), legg til:

```js
  const [lockedIds, setLockedIds] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, studentId, groupIdx }
```

**Step 2: Last `lockedIds` fra lagret oppdrag**

I `loadAssignment`, rett etter linje 55
(`try { setLeaderIds(JSON.parse(assignment.leader_ids || '[]')); } catch (e) { setLeaderIds([]); }`),
legg til:

```js
      try { setLockedIds(JSON.parse(assignment.locked_ids || '[]')); } catch (e) { setLockedIds([]); }
```

**Step 3: Bygg `lockedPlacements` i `handleRegenerate` og send dem til `generateGroups`**

Nåværende kode (linje 66–91):

```js
  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      let recentPairs = [];
      if (avoidLastN > 0) {
        const rows = await window.api.getGroupHistory(classId, avoidLastN);
        recentPairs = (rows || []).flatMap(row => {
          try { return JSON.parse(row.pairs); } catch (e) { return []; }
        });
      }
      const result = generateGroups({
        studentIds: allStudentIds,
        studentsById,
        numGroups: groups.length,
        constraints,
        useConstraints,
        leaderIds,
        requireLeaders,
        recentPairs,
      });
      setGroups(result.groups);
      setDirty(true);
    } catch (e) {}
    setRegenerating(false);
  };
```

Erstatt med:

```js
  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    try {
      let recentPairs = [];
      if (avoidLastN > 0) {
        const rows = await window.api.getGroupHistory(classId, avoidLastN);
        recentPairs = (rows || []).flatMap(row => {
          try { return JSON.parse(row.pairs); } catch (e) { return []; }
        });
      }
      const lockedPlacements = lockedIds
        .map(sid => {
          const groupIndex = groups.findIndex(g => g.includes(sid));
          return groupIndex === -1 ? null : { studentId: sid, groupIndex };
        })
        .filter(Boolean);
      const result = generateGroups({
        studentIds: allStudentIds,
        studentsById,
        numGroups: groups.length,
        constraints,
        useConstraints,
        lockedPlacements,
        leaderIds,
        requireLeaders,
        recentPairs,
      });
      setGroups(result.groups);
      setDirty(true);
    } catch (e) {}
    setRegenerating(false);
  };
```

**Step 4: Legg til lås- og leder-handlers**

Rett etter `moveStudent` (linje 93–102), legg til:

```js
  const toggleLock = (studentId) => {
    setLockedIds(prev => prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]);
    setDirty(true);
  };

  const setGroupLeader = (studentId, groupIdx) => {
    setLeaderIds(prev => {
      const others = new Set(groups[groupIdx].filter(id => id !== studentId));
      return [...prev.filter(id => !others.has(id) && id !== studentId), studentId];
    });
    setDirty(true);
  };

  const removeGroupLeader = (studentId) => {
    setLeaderIds(prev => prev.filter(id => id !== studentId));
    setDirty(true);
  };

  const handleStudentContextMenu = (e, studentId, groupIdx) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, studentId, groupIdx });
  };
```

**Step 5: Send `lockedIds` med ved lagring**

I `handleSave` (linje 104–121), i kallet til `window.api.saveGroupAssignment`, legg til
`lockedIds` i objektet:

```js
      await window.api.saveGroupAssignment({
        id: assignmentId, name: name.trim() || 'Uten navn', classId,
        sourceSeatingId: null, useConstraints, avoidLastN, requireLeaders, leaderIds, lockedIds,
        groups: groupsPayload,
      });
```

**Step 6: Verifiser syntaks**

Run: `npx vite build --logLevel warn 2>&1 | tail -40`
Expected: Bygget fullfører uten feil i `GroupEditor.jsx` (andre pre-eksisterende
advarsler i prosjektet er OK — se etter at ingen ny feil nevner `GroupEditor.jsx`).

**Step 7: Commit**

```bash
git add src/components/GroupEditor.jsx
git commit -m "feat: last/lagre lockedIds og koble til lockedPlacements ved regenerering"
```

---

### Task 4: `StudentContextMenu.jsx` — ny komponent

**Files:**
- Create: `src/components/GroupWork/StudentContextMenu.jsx`

**Step 1: Skriv komponenten**

Modellert på `src/components/SeatingChart/DeskContextMenu.jsx` sitt mønster (fast
posisjonert meny + usynlig backdrop som lukker den ved klikk utenfor):

```jsx
import React from 'react';

/** Høyreklikk-meny på et elevkort i gruppeeditoren: sett/fjern gruppeleder, lås/lås opp. */
export default function StudentContextMenu({
  contextMenu, studentsById, leaderIds, lockedIds,
  setGroupLeader, removeGroupLeader, toggleLock, setContextMenu,
}) {
  if (!contextMenu) return null;
  const { x, y, studentId, groupIdx } = contextMenu;
  const student = studentsById[studentId];
  if (!student) return null;

  const isLeader = leaderIds.includes(studentId);
  const isLocked = lockedIds.includes(studentId);

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)}></div>
      <div
        className="fixed z-[9999] bg-[#1a1e2b] border border-slate-700 shadow-2xl rounded-xl w-56 overflow-hidden flex flex-col"
        style={{ left: x, top: y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 bg-[#202534] border-b border-slate-700 text-xs font-bold text-slate-300 truncate">
          {student.name}
        </div>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-[#262b3a] text-slate-200 flex items-center gap-2 transition-colors"
          onClick={() => {
            if (isLeader) removeGroupLeader(studentId);
            else setGroupLeader(studentId, groupIdx);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid fa-star ${isLeader ? 'text-slate-500' : 'text-amber-400'} w-4`}></i>
          {isLeader ? 'Fjern som gruppeleder' : 'Gjør til gruppeleder'}
        </button>

        <button
          className="px-4 py-2.5 text-left text-sm hover:bg-[#262b3a] text-slate-200 flex items-center gap-2 transition-colors border-t border-slate-700/50"
          onClick={() => {
            toggleLock(studentId);
            setContextMenu(null);
          }}
        >
          <i className={`fa-solid ${isLocked ? 'fa-unlock text-emerald-400' : 'fa-lock text-red-400'} w-4`}></i>
          {isLocked ? 'Lås opp elev' : 'Lås elev'}
        </button>
      </div>
    </>
  );
}
```

**Step 2: Verifiser syntaks**

Run: `npx vite build --logLevel warn 2>&1 | tail -40`
Expected: Ingen feil som nevner `StudentContextMenu.jsx` (komponenten er ikke koblet
til noe ennå, så den bygges kun som en isolert, ubrukt fil — det er forventet at den
ikke er importert før Task 5).

**Step 3: Commit**

```bash
git add src/components/GroupWork/StudentContextMenu.jsx
git commit -m "feat: ny StudentContextMenu-komponent for leder/lås"
```

---

### Task 5: Koble høyreklikk-menyen inn i `GroupEditor.jsx`

**Files:**
- Modify: `src/components/GroupEditor.jsx`

**Step 1: Importer komponenten**

Øverst i filen, etter linje 3 (`import { generateGroups, buildGroupPairs } ...`):

```js
import StudentContextMenu from './GroupWork/StudentContextMenu';
```

**Step 2: Legg til `onContextMenu` og låst-indikator på elevkortet**

Nåværende kode (linje 202–221, elevraden inni `.map`):

```jsx
                  {studentIds.map(sid => {
                    const student = studentsById[sid];
                    if (!student) return null;
                    const isLeader = leaderIds.includes(sid);
                    return (
                      <div key={sid} className="flex items-center justify-between gap-2 bg-[#262b3a] rounded-lg px-2.5 py-1.5">
                        <span className="text-sm text-slate-200 truncate flex items-center gap-1.5">
                          {isLeader && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
                          {student.name}
                        </span>
                        <select
                          className="select select-bordered select-xs bg-[#1a1e2b] border-slate-700 text-slate-300"
                          value={idx}
                          onChange={(e) => moveStudent(sid, idx, Number(e.target.value))}
                        >
                          {groups.map((_, gi) => <option key={gi} value={gi}>Gruppe {gi + 1}</option>)}
                        </select>
                      </div>
                    );
                  })}
```

Erstatt `<select>`-en med et låse-ikon (dra-og-slipp fra Task 6 tar over selve flyttingen):

```jsx
                  {studentIds.map(sid => {
                    const student = studentsById[sid];
                    if (!student) return null;
                    const isLeader = leaderIds.includes(sid);
                    const isLocked = lockedIds.includes(sid);
                    return (
                      <div
                        key={sid}
                        onContextMenu={(e) => handleStudentContextMenu(e, sid, idx)}
                        className="flex items-center justify-between gap-2 bg-[#262b3a] rounded-lg px-2.5 py-1.5 cursor-grab select-none"
                      >
                        <span className="text-sm text-slate-200 truncate flex items-center gap-1.5">
                          {isLeader && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
                          {student.name}
                        </span>
                        {isLocked && <i className="fa-solid fa-lock text-red-400 text-[10px]" title="Låst"></i>}
                      </div>
                    );
                  })}
```

**Step 3: Render menyen**

Like før den avsluttende `</div>` i komponentens root (rett før
`<dialog id="modal_delete_group_assignment" ...>` på linje 229), legg til:

```jsx
      <StudentContextMenu
        contextMenu={contextMenu}
        studentsById={studentsById}
        leaderIds={leaderIds}
        lockedIds={lockedIds}
        setGroupLeader={setGroupLeader}
        removeGroupLeader={removeGroupLeader}
        toggleLock={toggleLock}
        setContextMenu={setContextMenu}
      />
```

**Step 4: Manuell verifikasjon**

Run: bruk `run`-skillet til å starte appen, åpne en gruppeinndeling, høyreklikk på en
elev.
Expected: Menyen vises ved musepekeren med «Gjør til gruppeleder» og «Lås elev»; å
trykke dem viser stjerne- hhv. hengelås-ikon på kortet, og klikk utenfor lukker menyen.
(Dra-og-slipp for selve flyttingen mangler fortsatt — det kommer i Task 6.)

**Step 5: Commit**

```bash
git add src/components/GroupEditor.jsx
git commit -m "feat: koble høyreklikk-meny og lås-indikator inn i gruppeeditoren"
```

---

### Task 6: Dra-og-slipp mellom grupper (erstatter dropdown helt)

**Files:**
- Modify: `src/components/GroupEditor.jsx`

**Step 1: Importer dnd-kit**

Øverst i filen:

```js
import { DndContext, useDraggable, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
```

**Step 2: Legg til to lokale subkomponenter nederst i filen** (under `export default
function GroupEditor(...) { ... }`, som frittstående funksjoner i samme fil — samme
mønster som at `GroupEditor.jsx` allerede holder all rendering i én fil):

```jsx
function StudentCard({ sid, student, isLeader, isLocked, onContextMenu }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: sid });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={onContextMenu}
      className="flex items-center justify-between gap-2 bg-[#262b3a] rounded-lg px-2.5 py-1.5 cursor-grab select-none touch-none"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <span className="text-sm text-slate-200 truncate flex items-center gap-1.5">
        {isLeader && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
        {student.name}
      </span>
      {isLocked && <i className="fa-solid fa-lock text-red-400 text-[10px]" title="Låst"></i>}
    </div>
  );
}

function GroupPanel({ idx, color, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `group-${idx}` });
  return (
    <div
      ref={setNodeRef}
      className={`bg-[#1a1e2b] border rounded-2xl overflow-hidden flex flex-col transition-colors ${isOver ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/30' : 'border-slate-800'}`}
    >
      {children}
    </div>
  );
}
```

**Step 3: Legg til drag-state og handlers i `GroupEditor`**

Sammen med de andre `useState`-linjene:

```js
  const [activeDragId, setActiveDragId] = useState(null);
```

Sammen med de andre handlerne (etter `handleStudentContextMenu`):

```js
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event) => setActiveDragId(event.active.id);

  const handleDragEnd = (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const toIdx = Number(String(over.id).slice('group-'.length));
    const fromIdx = groups.findIndex(g => g.includes(active.id));
    if (fromIdx === -1 || fromIdx === toIdx) return;
    moveStudent(active.id, fromIdx, toIdx);
  };
```

**Step 4: Wrap gruppe-gridet i `DndContext` og bytt ut kort-markup med subkomponentene**

Nåværende kode (linje 188–227, hele scroll-seksjonen):

```jsx
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
          {groups.map((studentIds, idx) => {
            const color = GROUP_COLORS[idx % GROUP_COLORS.length];
            return (
              <div key={idx} className="bg-[#1a1e2b] border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: `${color}22`, borderBottom: `2px solid ${color}` }}>
                  <span className="font-bold text-sm" style={{ color }}>Gruppe {idx + 1}</span>
                  <span className="text-xs text-slate-400">{studentIds.length} elever</span>
                </div>
                <div className="p-2 flex flex-col gap-1.5 flex-1">
                  {studentIds.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-3">Ingen elever</p>
                  )}
                  {studentIds.map(sid => {
                    const student = studentsById[sid];
                    if (!student) return null;
                    const isLeader = leaderIds.includes(sid);
                    const isLocked = lockedIds.includes(sid);
                    return (
                      <div
                        key={sid}
                        onContextMenu={(e) => handleStudentContextMenu(e, sid, idx)}
                        className="flex items-center justify-between gap-2 bg-[#262b3a] rounded-lg px-2.5 py-1.5 cursor-grab select-none"
                      >
                        <span className="text-sm text-slate-200 truncate flex items-center gap-1.5">
                          {isLeader && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
                          {student.name}
                        </span>
                        {isLocked && <i className="fa-solid fa-lock text-red-400 text-[10px]" title="Låst"></i>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
```

Erstatt med:

```jsx
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(220px, 1fr))` }}>
            {groups.map((studentIds, idx) => {
              const color = GROUP_COLORS[idx % GROUP_COLORS.length];
              return (
                <GroupPanel key={idx} idx={idx} color={color}>
                  <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: `${color}22`, borderBottom: `2px solid ${color}` }}>
                    <span className="font-bold text-sm" style={{ color }}>Gruppe {idx + 1}</span>
                    <span className="text-xs text-slate-400">{studentIds.length} elever</span>
                  </div>
                  <div className="p-2 flex flex-col gap-1.5 flex-1">
                    {studentIds.length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-3">Ingen elever</p>
                    )}
                    {studentIds.map(sid => {
                      const student = studentsById[sid];
                      if (!student) return null;
                      return (
                        <StudentCard
                          key={sid}
                          sid={sid}
                          student={student}
                          isLeader={leaderIds.includes(sid)}
                          isLocked={lockedIds.includes(sid)}
                          onContextMenu={(e) => handleStudentContextMenu(e, sid, idx)}
                        />
                      );
                    })}
                  </div>
                </GroupPanel>
              );
            })}
          </div>
        </div>
        <DragOverlay>
          {activeDragId ? (
            <div className="bg-[#262b3a] rounded-lg px-2.5 py-1.5 shadow-2xl border border-fuchsia-400 text-sm text-slate-100 flex items-center gap-1.5">
              {leaderIds.includes(activeDragId) && <i className="fa-solid fa-star text-amber-400 text-[10px]"></i>}
              {studentsById[activeDragId]?.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
```

**Step 5: Verifiser syntaks**

Run: `npx vite build --logLevel warn 2>&1 | tail -40`
Expected: Ingen build-feil relatert til `GroupEditor.jsx`.

**Step 6: Manuell verifikasjon**

Run: bruk `run`-skillet til å starte appen, åpne en gruppeinndeling med minst 2 grupper.
Expected:
- Dra et elevkort fra én gruppe til en annen — kortet flytter seg, mottakergruppa får en
  fuksia-ring mens du drar over den, og elevtallet i hver gruppe-header oppdateres.
- Slipp utenfor et gruppepanel — ingenting flyttes (`over` er `null`).
- Lås en elev via høyreklikk-menyen, trykk «Generer på nytt» — den låste eleven blir
  stående i samme gruppe, resten randomiseres.
- Sett en gruppeleder via høyreklikk-menyen på en elev i en gruppe som allerede har en
  annen leder — den forrige lederens stjerne forsvinner, den nye vises.
- Dra en låst elev manuelt til en annen gruppe — det skal fungere uhindret (lås gjelder
  kun regenerering, avklart med bruker).
- Trykk «Lagre», lukk og åpne inndelingen på nytt — lås- og leder-status er bevart.

**Step 7: Commit**

```bash
git add src/components/GroupEditor.jsx
git commit -m "feat: dra-og-slipp mellom grupper med @dnd-kit, fjern dropdown"
```

---

### Task 7: Rydd opp foreldet, ubrukt CSS

**Context:** `src/styles/group-editor.css` er en rest fra en tidligere vanilla-JS-versjon
av appen (`src/views/group-editor.js`, slettet under React-migreringen — se
`git log --oneline -- src/styles/group-editor.css`, commits `0280243` og `6b61b45`).
Filen importeres ikke av `src/index.css` eller noe annet, og ingen av CSS-klassene
(`.ge-chip`, `.ge-group-card`, `.drag-over`, osv.) refereres av noen `.jsx`-fil i
prosjektet i dag (bekreftet via grep). Den nye implementasjonen i denne planen bruker
Tailwind-klasser direkte, i tråd med resten av `GroupEditor.jsx`, så denne filen forblir
død kode. Siden den ligger i samme feature-område som det vi nettopp har bygget, fjernes
den for å unngå at den forveksles med aktiv styling.

**Files:**
- Delete: `src/styles/group-editor.css`

**Step 1: Bekreft at filen fortsatt er ubrukt**

Run: `grep -rn "group-editor.css\|ge-chip\|ge-group-card\|ge-groups-container\|ge-summary\|ge-leader-badge" src index.html --include=*.jsx --include=*.js --include=*.css --include=*.html | grep -v "styles/group-editor.css"`
Expected: Ingen treff.

**Step 2: Slett filen**

```bash
git rm src/styles/group-editor.css
```

**Step 3: Commit**

```bash
git commit -m "chore: fjern foreldet, ubrukt group-editor.css fra pre-React-appen"
```

---

### Task 8: Full manuell sluttverifikasjon

**Step 1:** Bruk `run`-skillet til å starte appen (`npm run dev` eller tilsvarende det
skillet velger).

**Step 2:** Gå gjennom hele flyten i gruppearbeidmodulen:
1. Opprett en ny gruppeinndeling (uendret flyt, `CreateGroupModal.jsx` er ikke rørt).
2. I editoren: dra minst to elever mellom ulike grupper — bekreft at det fungerer smidig
   og at elevtall og lagre-status («Ulagrede endringer») oppdateres riktig.
3. Høyreklikk en elev → «Gjør til gruppeleder» → bekreft stjerne vises, og at en
   eventuell tidligere leder i samme gruppe mister sin stjerne.
4. Høyreklikk samme elev → «Lås elev» → bekreft hengelås-ikon vises.
5. Trykk «Generer på nytt» flere ganger → bekreft at den låste eleven aldri flytter seg,
   mens resten varierer.
6. Trykk «Lagre» → lukk (Tilbake) → åpne inndelingen igjen fra oversikten → bekreft at
   lås og leder fortsatt er der.
7. Lås opp eleven via menyen, dra den til en annen gruppe manuelt → bekreft det
   fungerer.

**Step 3:** Rapporter resultatet. Hvis alt stemmer, planen er ferdig implementert.
