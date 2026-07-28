# Klassekart: flere Fun modes + fungerende regelmotor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fiks den ikke-fungerende regelmotoren for elevregler i klassekartet, og legg til
fem nye animerte "fun modes" (Roulette, Randombomb, Musikkstoler, Makkerbytte, Trekk en
elev/Spotlight) i `SeatingChart.jsx`, alle regel-bevisste der det er relevant.

**Architecture:** Én ny, rammeverk-fri modul (`src/lib/seatingSolver.mjs`) inneholder all
ren logikk (regel-scoring, "prøv N tilfeldige, behold beste"-søk, kronologisk
pult-sortering) og testes med Nodes innebygde testløper (`node --test`) — prosjektet har
ingen testrammeverk fra før, så dette introduserer ingen ny avhengighet. Alle fem fun
modes bygges i `SeatingChart.jsx` som `setTimeout`-kjeder som skriver til én delt,
transient "spøkelse"-tilstand (`funModeGhosts`) som overstyrer visningen av et sete uten
å røre den ekte `placements`-tilstanden (og dermed uten å trigge autolagring) før
animasjonen er ferdig. UI legges til i `Toolbar.jsx` sin eksisterende Fun mode-skuff.

**Tech Stack:** React 18 (Vite), ingen nye npm-avhengigheter. Testing: Node sin
innebygde `node:test` + `node:assert` (Node 24, ingen installasjon nødvendig).

**Design-dokument:** `docs/plans/2026-07-28-flere-fun-modes-design.md` (godkjent av
bruker — les dette først for bakgrunn/resonnement bak valgene under).

**Manuell verifisering fremfor UI-tester:** Dette prosjektet har ingen
komponent-/E2E-testoppsett, og konvensjonen i `CHANGELOG.md` er å verifisere nye
funksjoner "end-to-end via reell kjøring av appen (ikke bare bygget)". Følg samme
praksis her: etter hver oppgave som endrer UI/animasjon, kjør `npm run dev` (eller
`npx vite build` for et rent kompileringssjekk) og test funksjonen i den faktiske
Electron-appen. Kun den rene logikken i `seatingSolver.mjs` får automatiserte tester.

---

## Bakgrunnsnotat: `src/shared/` er dødt, IKKE gjenbrukbart

`src/shared/randomize.js`, `constraints.js`, `animate.js`, `renderDesks.js`,
`transforms.js`, `decoSvg.js`, `contextMenu.js`, `chartHelpers.js` er levninger fra
vanilla-JS-versjonen av appen (før commit `d236cda`, "migrate frontend from vanilla JS
views to React + Vite"). **Ingen** nåværende komponent importerer disse — kun
`shared/utils.js` og `shared/groupRandomizer.js` er faktisk i bruk (av
`GroupEditor.jsx`/`StationSetup.jsx`, et helt annet modul enn klassekartet). Ikke bygg
videre på eller importer fra de døde filene — datamodellen deres kan ha driftet fra
dagens skjema. Ny logikk skrives fra bunnen i `src/lib/seatingSolver.mjs`.

---

## Task 1: Regelmotor som ren, testbar modul

**Files:**
- Create: `src/lib/seatingSolver.mjs`
- Create: `test/seatingSolver.test.mjs`
- Modify: `package.json` (legg til `test`-script)

**Step 1: Skriv modulen**

```js
// src/lib/seatingSolver.mjs
/**
 * Ren, rammeverk-fri plasseringslogikk for klassekartet: sortering av seter i
 * kronologisk pult-rekkefølge, regel-scoring og "prøv N tilfeldige, behold beste"-søk.
 * Ingen avhengighet til React eller Electron — testes med `node --test`.
 */

const PRIORITY_PENALTY = { critical: 500, important: 150, wish: 30 };

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

/**
 * Sorterer seteplasser etter bordnummer (logisk posisjon i rommet, fra tavlen og
 * utover), slik at "de første N plassene" alltid betyr "de N plassene nærmest start på
 * et fullt bord først" — ingen elev havner alene ved et bord mens et tidligere bord står
 * halvfullt.
 * @param {Array<{slotKey: string, deskId: string, slotIdx: number}>} slots
 * @param {Array<{id: string, x: number, y: number}>} desks
 * @param {{y: number}} boardObj
 */
export function sortSlotsByDeskOrder(slots, desks, boardObj) {
  const isBoardAtTop = boardObj.y < 350;
  const sortedDesks = [...desks].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (isBoardAtTop) {
      if (Math.abs(yDiff) > 35) return yDiff;
      return a.x - b.x;
    } else {
      if (Math.abs(yDiff) > 35) return -yDiff;
      return b.x - a.x;
    }
  });

  const deskNumberMap = {};
  sortedDesks.forEach((d, idx) => { deskNumberMap[d.id] = idx + 1; });

  return [...slots].sort((a, b) => {
    const num1 = deskNumberMap[a.deskId] || 999;
    const num2 = deskNumberMap[b.deskId] || 999;
    if (num1 === num2) return a.slotIdx - b.slotIdx;
    return num1 - num2;
  });
}

/**
 * Scorer en kandidat-plassering mot klassens regler. Start 100, trekk fra per brudd,
 * skalert etter regelens prioritet.
 * @param {Object<string, string>} candidatePlacements - slotKey -> studentId
 * @param {Array<{type: string, priority: string, studentIds: string[]}>} classRules
 * @param {Array<{id: string, zones?: string[]}>} desks
 */
export function scoreClassPlacement(candidatePlacements, classRules, desks) {
  let score = 100;

  const deskIdForSlot = (slotKey) => slotKey.split('_seat_')[0];
  const deskForStudent = (studentId) => {
    const slotKey = Object.keys(candidatePlacements).find(k => candidatePlacements[k] === studentId);
    if (!slotKey) return null;
    return desks.find(d => d.id === deskIdForSlot(slotKey)) || null;
  };
  const hasZone = (desk, zone) => !!desk && Array.isArray(desk.zones) && desk.zones.includes(zone);

  (classRules || []).forEach(rule => {
    if (!rule || !rule.type) return;
    const penalty = PRIORITY_PENALTY[rule.priority] ?? PRIORITY_PENALTY.important;
    const ids = rule.studentIds || [];

    switch (rule.type) {
      case 'avoid': {
        const deskIds = ids.map(deskForStudent).filter(Boolean).map(d => d.id);
        if (deskIds.length > 1 && new Set(deskIds).size < deskIds.length) score -= penalty;
        break;
      }
      case 'pair':
      case 'supportPair': {
        if (ids.length < 2) break;
        const deskA = deskForStudent(ids[0]);
        const deskB = deskForStudent(ids[1]);
        if (deskA && deskB && deskA.id !== deskB.id) score -= penalty;
        break;
      }
      case 'nearBoard':
        ids.forEach(id => { if (!hasZone(deskForStudent(id), 'front')) score -= penalty; });
        break;
      case 'sitBack':
        ids.forEach(id => { if (!hasZone(deskForStudent(id), 'back')) score -= penalty; });
        break;
      case 'sitMiddle':
        ids.forEach(id => { if (!hasZone(deskForStudent(id), 'center')) score -= penalty; });
        break;
      case 'awayDoor':
        ids.forEach(id => { if (hasZone(deskForStudent(id), 'door')) score -= penalty; });
        break;
      case 'awayWindow':
        ids.forEach(id => { if (hasZone(deskForStudent(id), 'window')) score -= penalty; });
        break;
      default:
        break;
    }
  });

  return score;
}

/**
 * Prøver `attempts` tilfeldige tildelinger av `students` til `seatSlots` (lagt oppå
 * `basePlacements`, f.eks. låste seter) og beholder den høyest scorende. Fyller ALDRI
 * flere seter enn det er studenter til — ubrukte seter blir stående tomme.
 * @param {{seatSlots: Array, students: Array<{id: string}>, basePlacements?: Object, classRules?: Array, desks?: Array, attempts?: number}} opts
 * @returns {{placements: Object<string, string>, score: number}}
 */
export function findBestPlacement({ seatSlots, students, basePlacements = {}, classRules = [], desks = [], attempts = 35 }) {
  let topScore = -Infinity;
  let topPlacements = { ...basePlacements };

  for (let attempt = 0; attempt < attempts; attempt++) {
    const testPlacements = { ...basePlacements };
    const shuffledStudents = shuffle(students);
    const shuffledSlots = shuffle(seatSlots);

    shuffledStudents.forEach((st, idx) => {
      if (idx < shuffledSlots.length) testPlacements[shuffledSlots[idx].slotKey] = st.id;
    });

    const score = scoreClassPlacement(testPlacements, classRules, desks);
    if (score > topScore) {
      topScore = score;
      topPlacements = testPlacements;
    }
  }

  return { placements: topPlacements, score: topScore };
}
```

**Step 2: Skriv testene**

```js
// test/seatingSolver.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortSlotsByDeskOrder, scoreClassPlacement, findBestPlacement } from '../src/lib/seatingSolver.mjs';

const boardObj = { x: 422, y: 15 }; // tavle øverst

function makeDesks() {
  return [
    { id: 'd1', x: 100, y: 100, capacity: 2, zones: ['front'] },
    { id: 'd2', x: 300, y: 100, capacity: 2, zones: [] },
    { id: 'd3', x: 100, y: 300, capacity: 2, zones: ['door'] },
    { id: 'd4', x: 300, y: 300, capacity: 2, zones: ['back', 'window'] },
  ];
}

function buildSeatSlots(desks) {
  const slots = [];
  desks.forEach(d => {
    for (let s = 0; s < d.capacity; s++) slots.push({ slotKey: `${d.id}_seat_${s}`, deskId: d.id, slotIdx: s });
  });
  return slots;
}

test('sortSlotsByDeskOrder: fyller kronologisk, ingen isolerte elever ved delvis fylling', () => {
  const desks = makeDesks();
  const seatSlots = buildSeatSlots(desks);
  const sorted = sortSlotsByDeskOrder(seatSlots, desks, boardObj);

  // 3 elever, 8 seter -> kun seter fra de(t) første bord-paret i rekkefølge skal brukes.
  const targetSlots = sorted.slice(0, 3);
  const desksUsed = new Set(targetSlots.map(s => s.deskId));
  // De 3 første setene skal komme fra maks 2 pulter, og alltid de "tidligste" i rommet
  // (d1 og d2, øverste rad, venstre til høyre) - aldri hoppe over en pult.
  assert.ok(desksUsed.size <= 2);
  assert.ok([...desksUsed].every(id => id === 'd1' || id === 'd2'));
});

test('scoreClassPlacement: avoid-regel gir straff kun når elever faktisk deler pult', () => {
  const desks = makeDesks();
  const rule = { type: 'avoid', priority: 'critical', studentIds: ['s1', 's2'] };

  const separated = { d1_seat_0: 's1', d2_seat_0: 's2' };
  const together = { d1_seat_0: 's1', d1_seat_1: 's2' };

  assert.equal(scoreClassPlacement(separated, [rule], desks), 100);
  assert.equal(scoreClassPlacement(together, [rule], desks), 100 - 500);
});

test('scoreClassPlacement: pair-regel straffer når de IKKE sitter sammen', () => {
  const desks = makeDesks();
  const rule = { type: 'pair', priority: 'important', studentIds: ['s1', 's2'] };

  const together = { d1_seat_0: 's1', d1_seat_1: 's2' };
  const apart = { d1_seat_0: 's1', d2_seat_0: 's2' };

  assert.equal(scoreClassPlacement(together, [rule], desks), 100);
  assert.equal(scoreClassPlacement(apart, [rule], desks), 100 - 150);
});

test('scoreClassPlacement: sone-regler (nearBoard/sitBack/sitMiddle/awayDoor/awayWindow)', () => {
  const desks = makeDesks(); // d1=front, d3=door, d4=back+window

  const nearBoardOk = { d1_seat_0: 's1' };
  const nearBoardBad = { d2_seat_0: 's1' };
  assert.equal(scoreClassPlacement(nearBoardOk, [{ type: 'nearBoard', priority: 'wish', studentIds: ['s1'] }], desks), 100);
  assert.equal(scoreClassPlacement(nearBoardBad, [{ type: 'nearBoard', priority: 'wish', studentIds: ['s1'] }], desks), 100 - 30);

  const awayDoorOk = { d1_seat_0: 's1' };
  const awayDoorBad = { d3_seat_0: 's1' };
  assert.equal(scoreClassPlacement(awayDoorOk, [{ type: 'awayDoor', priority: 'important', studentIds: ['s1'] }], desks), 100);
  assert.equal(scoreClassPlacement(awayDoorBad, [{ type: 'awayDoor', priority: 'important', studentIds: ['s1'] }], desks), 100 - 150);

  const awayWindowBad = { d4_seat_0: 's1' };
  assert.equal(scoreClassPlacement(awayWindowBad, [{ type: 'awayWindow', priority: 'critical', studentIds: ['s1'] }], desks), 100 - 500);
});

test('findBestPlacement: finner en løsning som tilfredsstiller en oppnåelig avoid-regel', () => {
  const desks = makeDesks();
  const seatSlots = buildSeatSlots(desks);
  const students = [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }];
  const rule = { type: 'avoid', priority: 'critical', studentIds: ['s1', 's2'] };

  const { placements, score } = findBestPlacement({ seatSlots, students, classRules: [rule], desks });
  assert.equal(score, 100); // fullt oppnåelig med 4 seter fordelt på 4 pulter
  assert.equal(Object.values(placements).length, 4);
});

test('findBestPlacement: fyller aldri flere seter enn det er studenter', () => {
  const desks = makeDesks();
  const seatSlots = buildSeatSlots(desks); // 8 seter
  const students = [{ id: 's1' }, { id: 's2' }, { id: 's3' }]; // 3 studenter

  const { placements } = findBestPlacement({ seatSlots, students, desks });
  assert.equal(Object.values(placements).length, 3);
});
```

**Step 3: Kjør testene, verifiser at de passerer**

Legg til i `package.json` sin `"scripts"`:

```json
"test": "node --test test/"
```

Run: `npm test`
Expected: alle 6 tester PASS, 0 fail.

**Step 4: Commit**

```bash
git add src/lib/seatingSolver.mjs test/seatingSolver.test.mjs package.json
git commit -m "$(cat <<'EOF'
feat: ren, testet regelmotor for klassekart-plassering

Erstatter den tidligere ikke-fungerende evaluatePlacementScore (sjekket
en regeltype/felt-navn som ikke lenger finnes) med en modul som faktisk
matcher dagens regelskjema (type/priority/studentIds), og som testes
med Nodes innebygde testløper (node --test).
EOF
)"
```

---

## Task 2: Koble regelmotoren inn i `SeatingChart.jsx` (Randomiser + Plasser alle)

**Files:**
- Modify: `src/components/SeatingChart.jsx:621-766` (erstattes)

**Step 1: Importer modulen**

Legg til øverst i `src/components/SeatingChart.jsx`, sammen med de andre importene:

```js
import { sortSlotsByDeskOrder, findBestPlacement } from '../lib/seatingSolver.mjs';
```

**Step 2: Erstatt den lokale `sortSlotsByDeskOrder` + `handleAutoFill` + `handleRuleBasedFunSpin`**

Fjern hele blokken fra `// Sorterer seteplasser...` (linje ~621) til slutten av
`handleRuleBasedFunSpin` (linje ~766, rett før kommentaren om Gradvis avdekking), og
erstatt med:

```js
  const handleAutoFill = () => {
    let seatSlots = [];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) {
          seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
        }
      }
    });

    let availableStudents = [...unplacedStudents];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey] && placements[slotKey]) {
          availableStudents.push(getStudentByIdOrName(placements[slotKey]));
        }
      }
    });

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, availableStudents.length);

    const { placements: bestCandidate } = findBestPlacement({
      seatSlots: targetSlots,
      students: availableStudents,
      basePlacements,
      classRules,
      desks,
    });

    const finalPlacedVals = Object.values(bestCandidate);
    const finalUnplaced = availableStudents.filter(s => !finalPlacedVals.includes(s.id) && !finalPlacedVals.includes(s.name));

    setPlacements(bestCandidate);
    setUnplacedStudents(finalUnplaced);
  };

  // Randomiserer elevplassering umiddelbart (ingen animasjon) — bruker den delte
  // regelmotoren i src/lib/seatingSolver.mjs (samme motor som Roulette/Randombomb/
  // Musikkstoler/Makkerbytte bruker for å beregne SITT sluttresultat).
  const handleRuleBasedFunSpin = () => {
    let seatSlots = [];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) {
          seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
        }
      }
    });

    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);

    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, allStudents.length);

    const { placements: topPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: allStudents,
      basePlacements,
      classRules,
      desks,
    });

    setPlacements(topPlacements);
    const finalVals = Object.values(topPlacements);
    setUnplacedStudents(allStudents.filter(s => !finalVals.includes(s.id)));
  };

```

**Step 3: Verifiser kompilering**

Run: `npx vite build`
Expected: bygger uten feil (ingen referanser til den slettede lokale
`sortSlotsByDeskOrder`/`evaluatePlacementScore` skal gjenstå).

**Step 4: Manuell verifisering i appen**

- `npm run dev`, åpne et klassekart med minst 6 elever og et rom med >6 seter.
- I Elevoversikt (`ClassManager.jsx`): lag en `avoid`-regel (kritisk) for 2 elever, og en
  `pair`-regel (viktig) for 2 andre elever.
- Trykk "Randomiser" flere ganger i klassekartet: verifiser at avoid-paret ALDRI havner
  ved samme pult, og at pair-paret som oftest (helst alltid, med kun 4 seter og 35 forsøk)
  havner sammen.
- Trykk "Plasser alle" med noen elever allerede plassert og noen uplasserte: verifiser
  samme regel-respekt for de nye plasseringene, og at ingen elev havner isolert ved et
  bord mens et tidligere bord står tomt (samme sjekk som i forrige rettelse).

**Step 5: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "$(cat <<'EOF'
fix: Randomiser og Plasser alle bruker nå den fungerende regelmotoren

Begge kalte tidligere enten ingen regelsjekk (Plasser alle) eller en
regelsjekk som så etter et regeltype/felt-navn som ikke finnes i dagens
datamodell (Randomiser). Begge bruker nå src/lib/seatingSolver.mjs.
EOF
)"
```

---

## Task 3: Delt animasjonsinfrastruktur for de nye fun modes

**Files:**
- Modify: `src/components/SeatingChart.jsx`

**Step 1: Ny state**

Legg til rett under den eksisterende "Gradvis avdekking"-blokken (rundt linje 84-87):

```js
  // Delte fun modes (Roulette/Randombomb/Musikkstoler/Makkerbytte/Spotlight).
  // Under en kjøring vises `funModeGhosts` OPPÅ de virkelige `placements` for de
  // aktuelle setene — selve `placements` (og dermed autolagringen) røres ikke før
  // resultatet er avgjort, bortsett fra Roulette som committer én elev om gangen
  // (se Task 4).
  const [activeFunMode, setActiveFunMode] = useState(null); // 'roulette' | 'randombomb' | 'musikkstoler' | 'makkerbytte' | 'spotlight' | null
  const [funModeGhosts, setFunModeGhosts] = useState(null); // { [slotKey]: studentId | null } | null
  const [bombCountdown, setBombCountdown] = useState(null);
  const [bombBoom, setBombBoom] = useState(false);
  const [spotlightSlotKey, setSpotlightSlotKey] = useState(null);
```

Legg til to nye refs sammen med de andre `useRef`-linjene (rundt linje 90-92):

```js
  const funModeTimerRef = useRef(null);
  const funModeFinalRef = useRef(null); // beregnet sluttresultat for gjeldende kjøring
  const funModePreStateRef = useRef(null); // placements før Randombomb startet (for avbrytelse)
```

**Step 2: Delte hjelpefunksjoner**

Legg til rett etter `handleRuleBasedFunSpin` (fra Task 2):

```js
  const clearFunModeTimer = () => {
    if (funModeTimerRef.current) {
      clearTimeout(funModeTimerRef.current);
      funModeTimerRef.current = null;
    }
  };

  // Rydder opp løpende animasjoner hvis komponenten forlates (naviger bort) midt i en
  // fun mode-kjøring.
  useEffect(() => () => clearFunModeTimer(), []);

  // Setter det endelige, ekte resultatet og oppdaterer uplasserte-listen deretter.
  const applyFunModeResult = (finalPlacements) => {
    setPlacements(finalPlacements);
    const finalVals = Object.values(finalPlacements);
    setUnplacedStudents(allStudents.filter(s => !finalVals.includes(s.id) && !finalVals.includes(s.name)));
  };

  // Felles avslutning: stopper timer, fjerner spøkelses-/nedtellings-visning. Rører
  // ALDRI spotlightSlotKey — den gule uthevningen skal stå til neste trekning.
  const endFunMode = () => {
    clearFunModeTimer();
    setFunModeGhosts(null);
    setBombCountdown(null);
    setBombBoom(false);
    setActiveFunMode(null);
    funModeFinalRef.current = null;
    funModePreStateRef.current = null;
  };

  // Bygger listen av ikke-låste seteplasser for hele klasserommet — brukt av alle fem
  // fun modes (Makkerbytte bruker en egen, filtrert variant, se Task 7).
  const buildOpenSeatSlots = () => {
    const seatSlots = [];
    desks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
      }
    });
    return seatSlots;
  };
```

**Step 3: Verifiser kompilering**

Run: `npx vite build`
Expected: bygger uten feil (den nye staten/funksjonene brukes ingen steder ennå, så
ingen "unused"-advarsler siden dette prosjektet ikke kjører ESLint i CI — kun bygg-feil
er relevant her).

**Step 4: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "feat: delt animasjonsinfrastruktur for kommende fun modes"
```

---

## Task 4: Roulette

**Files:**
- Modify: `src/components/SeatingChart.jsx`

**Step 1: Legg til Roulette-logikken**

Rett etter `buildOpenSeatSlots` (fra Task 3):

```js
  const ROULETTE_HOP_DELAYS = [90, 100, 120, 150, 190, 250]; // ms per hopp, bremser ned
  const ROULETTE_PAUSE_AFTER_LANDING = 150; // ms før neste elev starter

  const startRoulette = () => {
    if (activeFunMode || revealMode) return;
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);
    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, allStudents.length);

    const { placements: finalPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: allStudents,
      basePlacements,
      classRules,
      desks,
    });

    const revealOrderIds = allStudents
      .map(s => s.id)
      .filter(id => Object.values(finalPlacements).includes(id))
      .sort(() => Math.random() - 0.5);

    funModeFinalRef.current = finalPlacements;
    setActiveFunMode('roulette');
    setPlacements(basePlacements);
    runRouletteStep(revealOrderIds, finalPlacements, basePlacements, 0);
  };

  const runRouletteStep = (order, finalPlacements, committedPlacements, idx) => {
    if (idx >= order.length) {
      applyFunModeResult(finalPlacements);
      endFunMode();
      return;
    }

    const studentId = order[idx];
    const finalSlotKey = Object.keys(finalPlacements).find(k => finalPlacements[k] === studentId);
    const openSlots = Object.keys(finalPlacements).filter(k => !committedPlacements[k] && k !== finalSlotKey);
    const hopPool = openSlots.length > 0 ? openSlots : [finalSlotKey];
    const hopSlotKeys = ROULETTE_HOP_DELAYS.map(() => hopPool[Math.floor(Math.random() * hopPool.length)]);

    const runHop = (hopIdx) => {
      if (hopIdx >= hopSlotKeys.length) {
        const updated = { ...committedPlacements, [finalSlotKey]: studentId };
        setFunModeGhosts(null);
        setPlacements(updated);
        funModeTimerRef.current = setTimeout(
          () => runRouletteStep(order, finalPlacements, updated, idx + 1),
          ROULETTE_PAUSE_AFTER_LANDING
        );
        return;
      }
      setFunModeGhosts({ [hopSlotKeys[hopIdx]]: studentId });
      funModeTimerRef.current = setTimeout(() => runHop(hopIdx + 1), ROULETTE_HOP_DELAYS[hopIdx]);
    };

    runHop(0);
  };

  const stopRoulette = () => {
    if (!funModeFinalRef.current) return;
    clearFunModeTimer();
    applyFunModeResult(funModeFinalRef.current);
    endFunMode();
  };
```

**Step 2: Vis spøkelset i sete-rendringen**

I den store `desks.map((d) => { ... })`-rendringen, finn linjen (rundt linje 1167):

```js
                              const studentVal = placements[slotKey];
```

Erstatt med:

```js
                              const ghostVal = funModeGhosts ? funModeGhosts[slotKey] : undefined;
                              const isGhostSeat = ghostVal !== undefined;
                              const studentVal = isGhostSeat ? ghostVal : placements[slotKey];
```

Finn deretter `isHoverTarget`-highlight-blokken (rundt linje 1181-1183):

```js
                              if (isHoverTarget) {
                                bgClass = 'border-2 border-emerald-400 bg-emerald-500/40 shadow-[0_0_20px_rgba(52,211,153,0.9)] scale-105 z-30 animate-pulse text-white font-extrabold';
                              }
```

Legg til rett etter (spøkelse-stil, egen farge slik at den ikke forveksles med
dra-og-slipp-highlighten eller historikk-fargene):

```js
                              if (isGhostSeat) {
                                bgClass = studentObj
                                  ? 'border-2 border-amber-400 bg-amber-500/25 shadow-[0_0_18px_rgba(251,191,36,0.7)] scale-[1.03] z-30 text-white font-extrabold animate-pulse'
                                  : 'border-2 border-amber-400/40 bg-amber-500/5';
                              }
```

Ingen andre endringer trengs i denne rendringsblokken — `studentObj` er allerede utledet
fra `studentVal` lenger ned, så navnevisningen fungerer identisk for spøkelser og ekte
plasseringer.

**Step 3: Deaktiver dra-og-slipp mens en fun mode kjører**

Finn linjen (rundt linje 1217):

```js
                                      onMouseDown={(e) => { if (activeGroupId === null && !revealMode) startDrag(e, studentObj, slotKey); }}
```

Erstatt med:

```js
                                      onMouseDown={(e) => { if (activeGroupId === null && !revealMode && !activeFunMode) startDrag(e, studentObj, slotKey); }}
```

**Step 4: Send nye props til `Toolbar`**

Finn `<Toolbar ... />`-kallet (rundt linje 1030-1045) og legg til:

```js
            activeFunMode={activeFunMode}
            startRoulette={startRoulette} stopRoulette={stopRoulette}
```

(De resterende fun-mode-props'ene legges til i Task 5-8 — ikke fjern noe eksisterende.)

**Step 5: Manuell verifisering**

- `npm run dev`, åpne et klassekart med ~10 elever, noen seter tomme/uplasserte.
- Trykk "Start roulette" (knapp legges til i Task 9 — hvis Toolbar-UI ikke er koblet
  ennå, kall `startRoulette()` midlertidig fra devtools-konsollen via en global for å
  teste isolert, ELLER vent med denne manuelle testen til Task 9 er gjort og test da).
- Verifiser: elevene "hopper" synlig gjennom flere ledige seter før de lander, kjører
  automatisk til alle er plassert, ingen elev havner ved et bord alene mens et annet bord
  er tomt (samme kronologiske fylling som før), og reglene overholdes i sluttresultatet.
- Test at en avoid-regel aldri brytes i sluttresultatet over flere kjøringer.

**Step 6: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "feat: Roulette fun mode — elever plasseres én og én med spinn-animasjon"
```

---

## Task 5: Randombomb

**Files:**
- Modify: `src/components/SeatingChart.jsx`

**Step 1: Legg til Randombomb-logikken**

Rett etter Roulette-koden fra Task 4:

```js
  const RANDOMBOMB_TICK_MS = 700;

  const startRandombomb = () => {
    if (activeFunMode || revealMode) return;
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);
    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, allStudents.length);

    const { placements: finalPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: allStudents,
      basePlacements,
      classRules,
      desks,
    });

    funModeFinalRef.current = finalPlacements;
    funModePreStateRef.current = { ...placements };
    setActiveFunMode('randombomb');
    runBombTick(targetSlots, allStudents, 5);
  };

  const runBombTick = (targetSlots, students, count) => {
    setBombCountdown(count);

    if (count <= 1) {
      funModeTimerRef.current = setTimeout(() => {
        setFunModeGhosts(null);
        applyFunModeResult(funModeFinalRef.current);
        setBombBoom(true);
        funModeTimerRef.current = setTimeout(() => endFunMode(), 500);
      }, RANDOMBOMB_TICK_MS);
      return;
    }

    const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
    const shuffledSlots = [...targetSlots].sort(() => Math.random() - 0.5);
    const ghostMap = {};
    shuffledSlots.forEach((slot, idx) => {
      ghostMap[slot.slotKey] = idx < shuffledStudents.length ? shuffledStudents[idx].id : null;
    });
    setFunModeGhosts(ghostMap);

    funModeTimerRef.current = setTimeout(() => runBombTick(targetSlots, students, count - 1), RANDOMBOMB_TICK_MS);
  };

  const cancelRandombomb = () => {
    clearFunModeTimer();
    if (funModePreStateRef.current) setPlacements(funModePreStateRef.current);
    endFunMode();
  };
```

**Step 2: Legg til nedtellings-overlay**

Finn `<div className="flex-1 flex flex-col overflow-hidden relative bg-[#131620]" ...>`
(canvas-container, rundt linje 1064) og legg til rett innenfor åpningstaggen, før
`isProjectorMode`-blokken:

```jsx
          {activeFunMode === 'randombomb' && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
              <div className={`text-[10rem] font-black drop-shadow-[0_0_30px_rgba(244,63,94,0.8)] transition-transform ${bombBoom ? 'text-emerald-400 scale-125' : 'text-rose-500 animate-bounce'}`}>
                {bombBoom ? '💥' : bombCountdown}
              </div>
            </div>
          )}
```

**Step 3: Send nye props til `Toolbar`**

Legg til i `<Toolbar ... />`-kallet:

```js
            bombCountdown={bombCountdown} bombBoom={bombBoom}
            startRandombomb={startRandombomb} cancelRandombomb={cancelRandombomb}
```

**Step 4: Manuell verifisering**

(Kan testes isolert fra devtools-konsollen frem til Task 9, som i Task 4 Step 5, eller
vent til Task 9.)

- Verifiser nedtelling 5→1 vises stort og tydelig midt i klasseromsvisningen.
- Verifiser at seter synlig "flimrer" tilfeldig ved hvert tikk 5→2.
- Verifiser at sluttresultatet (etter "💥") respekterer klassereglene, og at "Avbryt"
  midtveis gjenoppretter nøyaktig plasseringen fra før bomben startet.

**Step 5: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "feat: Randombomb fun mode — nedtelling 5-4-3-2-1 med tilfeldig flimring"
```

---

## Task 6: Musikkstoler

**Files:**
- Modify: `src/components/SeatingChart.jsx`

**Step 1: Legg til Musikkstoler-logikken (og delt `runFlashTick`)**

Rett etter Randombomb-koden fra Task 5. `runFlashTick` gjenbrukes uendret av Makkerbytte
i Task 7:

```js
  const FUN_FLASH_COUNT = 5;
  const FUN_FLASH_MS = 120;

  // Rask "alle stoler flimrer"-animasjon uten nedtelling — brukes av både Musikkstoler
  // og Makkerbytte (som sender inn en begrenset targetSlots/students-delmengde).
  const runFlashTick = (targetSlots, students, remaining) => {
    if (remaining <= 0) {
      setFunModeGhosts(null);
      applyFunModeResult(funModeFinalRef.current);
      endFunMode();
      return;
    }

    const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
    const shuffledSlots = [...targetSlots].sort(() => Math.random() - 0.5);
    const ghostMap = {};
    shuffledSlots.forEach((slot, idx) => {
      ghostMap[slot.slotKey] = idx < shuffledStudents.length ? shuffledStudents[idx].id : null;
    });
    setFunModeGhosts(ghostMap);

    funModeTimerRef.current = setTimeout(() => runFlashTick(targetSlots, students, remaining - 1), FUN_FLASH_MS);
  };

  const startMusikkstoler = () => {
    if (activeFunMode || revealMode) return;
    const seatSlots = buildOpenSeatSlots();
    if (seatSlots.length === 0 || allStudents.length === 0) return;

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);
    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, allStudents.length);

    const { placements: finalPlacements } = findBestPlacement({
      seatSlots: targetSlots,
      students: allStudents,
      basePlacements,
      classRules,
      desks,
    });

    funModeFinalRef.current = finalPlacements;
    setActiveFunMode('musikkstoler');
    runFlashTick(targetSlots, allStudents, FUN_FLASH_COUNT);
  };
```

**Step 2: Send nye props til `Toolbar`**

```js
            startMusikkstoler={startMusikkstoler}
```

**Step 3: Manuell verifisering**

- Verifiser at hele klassen "flimrer" raskt (under ~1 sekund totalt) og lander på et
  regel-riktig resultat, uten synlig nedtellingstall.

**Step 4: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "feat: Musikkstoler fun mode — rask full stokk uten nedtelling"
```

---

## Task 7: Makkerbytte

**Files:**
- Modify: `src/components/SeatingChart.jsx`

**Step 1: Legg til Makkerbytte-logikken**

Rett etter Musikkstoler-koden fra Task 6. Gjenbruker `runFlashTick`:

```js
  const startMakkerbytte = () => {
    if (activeFunMode || revealMode) return;

    const groupedDesks = desks.filter(d => (groupOverrides[d.id] || d.groupId));
    if (groupedDesks.length === 0) return;

    let seatSlots = [];
    groupedDesks.forEach(d => {
      const cap = d.capacity || 1;
      for (let s = 0; s < cap; s++) {
        const slotKey = `${d.id}_seat_${s}`;
        if (!lockedSeats[slotKey]) seatSlots.push({ slotKey, deskId: d.id, slotIdx: s, desk: d });
      }
    });
    if (seatSlots.length === 0) return;

    // Elever som allerede sitter i en gruppe-pult, pluss uplasserte (kan trekkes inn
    // hvis det er ledig plass i gruppene). Elever ved ugrupperte pulter røres ikke.
    const groupedSeatKeys = new Set(seatSlots.map(s => s.slotKey));
    const groupedStudents = Object.entries(placements)
      .filter(([slotKey]) => groupedSeatKeys.has(slotKey))
      .map(([, studentId]) => getStudentByIdOrName(studentId));
    const candidateStudents = [...groupedStudents, ...unplacedStudents];

    const basePlacements = { ...placements };
    seatSlots.forEach(slot => delete basePlacements[slot.slotKey]);
    const sortedSlots = sortSlotsByDeskOrder(seatSlots, desks, boardObj);
    const targetSlots = sortedSlots.slice(0, candidateStudents.length);

    const { placements: groupResult } = findBestPlacement({
      seatSlots: targetSlots,
      students: candidateStudents,
      basePlacements,
      classRules,
      desks,
    });

    // Slå sammen med resten av klasserommet, som IKKE er del av denne kjøringen.
    const finalPlacements = { ...placements };
    seatSlots.forEach(slot => delete finalPlacements[slot.slotKey]);
    Object.assign(finalPlacements, groupResult);

    funModeFinalRef.current = finalPlacements;
    setActiveFunMode('makkerbytte');
    runFlashTick(targetSlots, candidateStudents, FUN_FLASH_COUNT);
  };
```

**Step 2: Send nye props til `Toolbar`**

```js
            startMakkerbytte={startMakkerbytte}
```

**Step 3: Manuell verifisering**

- Sett opp 2-3 fargede makkergrupper (via lasso-verktøyet i klassekartet) på et rom med
  også ugrupperte pulter.
- Trykk "Bytt om grupper": verifiser at KUN elevene ved de fargede pultene bytter plass
  seg imellom (og eventuelt trekker inn uplasserte), mens ugrupperte pulter/elever er
  helt uendret gjennom hele animasjonen.
- Test med 0 aktive grupper: knappen skal ikke gjøre noe (ingen krasj).

**Step 4: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "feat: Makkerbytte fun mode — randomiserer kun elever i fargede makkergrupper"
```

---

## Task 8: Trekk en elev (Spotlight)

**Files:**
- Modify: `src/components/SeatingChart.jsx`

**Step 1: Legg til Spotlight-logikken**

Rett etter Makkerbytte-koden fra Task 7. Merk: Spotlight endrer ALDRI `placements` — det
er en ren "hvem skal svare"-trekning blant allerede plasserte elever.

```js
  const SPOTLIGHT_HOP_DELAYS = [80, 90, 110, 140, 180, 230, 300];

  const startSpotlight = () => {
    if (activeFunMode || revealMode) return;
    const occupiedSlotKeys = Object.keys(placements).filter(k => placements[k]);
    if (occupiedSlotKeys.length === 0) return;

    setActiveFunMode('spotlight');
    setSpotlightSlotKey(null);
    runSpotlightHop(occupiedSlotKeys, 0);
  };

  const runSpotlightHop = (occupiedSlotKeys, hopIdx) => {
    if (hopIdx >= SPOTLIGHT_HOP_DELAYS.length) {
      const finalPick = occupiedSlotKeys[Math.floor(Math.random() * occupiedSlotKeys.length)];
      setSpotlightSlotKey(finalPick);
      endFunMode();
      return;
    }
    const hop = occupiedSlotKeys[Math.floor(Math.random() * occupiedSlotKeys.length)];
    setSpotlightSlotKey(hop);
    funModeTimerRef.current = setTimeout(() => runSpotlightHop(occupiedSlotKeys, hopIdx + 1), SPOTLIGHT_HOP_DELAYS[hopIdx]);
  };

  const dismissSpotlight = () => {
    endFunMode();
    setSpotlightSlotKey(null);
  };
```

**Step 2: Vis den gyldne gløden i sete-rendringen**

Rett etter `isGhostSeat`-blokken fra Task 4 Step 2, legg til:

```js
                              const isSpotlit = spotlightSlotKey === slotKey;
                              if (isSpotlit) {
                                bgClass = 'border-2 border-yellow-400 bg-yellow-400/20 shadow-[0_0_25px_rgba(250,204,21,0.85)] scale-105 z-30 text-white font-extrabold';
                              }
```

(Plasser denne rett etter `isGhostSeat`-if-en, slik at spotlight kan overstyre om begge
skulle inntreffe samtidig — i praksis skjer de aldri samtidig siden `activeFunMode`-lås
hindrer det, men rekkefølgen gjør koden robust uansett.)

**Step 3: Send nye props til `Toolbar`**

```js
            spotlightSlotKey={spotlightSlotKey}
            startSpotlight={startSpotlight} dismissSpotlight={dismissSpotlight}
```

**Step 4: Manuell verifisering**

- Plasser noen elever, la noen seter stå tomme.
- Trykk "Trekk elev" flere ganger: verifiser at kun plasserte elever kan trekkes (aldri
  et tomt sete), at highlighten hopper synlig rundt før den lander, og at gløden blir
  stående til neste trekning eller til "Fjern uthevning" trykkes.
- Verifiser at andre fun modes / Randomiser fortsatt fungerer normalt mens en tidligere
  spotlight-glød fortsatt vises (siden `activeFunMode` går tilbake til `null` etter at
  spotlight lander).

**Step 5: Commit**

```bash
git add src/components/SeatingChart.jsx
git commit -m "feat: Trekk en elev (Spotlight) fun mode — tilfeldig elev-trekning"
```

---

## Task 9: UI i Fun mode-skuffen (`Toolbar.jsx`)

**Files:**
- Modify: `src/components/SeatingChart/Toolbar.jsx`

**Step 1: Utvid prop-signaturen**

Finn funksjonssignaturen (linje 8-21) og legg til de nye props'ene sammen med de
eksisterende fun-mode-relaterte (`handleRuleBasedFunSpin`, `revealMode`, osv.):

```js
export default function Toolbar({
  unplacedStudents,
  showStudentDrawer, setShowStudentDrawer,
  showGroupDrawer, setShowGroupDrawer, activeGroupId, setActiveGroupId, GROUP_COLORS,
  showFunDrawer, setShowFunDrawer,
  hideGroups, setHideGroups,
  handleRuleBasedFunSpin, handleAutoFill, flipRoom, handlePrint,
  showHistory, setShowHistory,
  showNumbers, setShowNumbers,
  showZones, setShowZones,
  hideSensitiveInfo, setHideSensitiveInfo,
  setIsProjectorMode,
  revealMode, revealedCount, revealTotal, startReveal, revealNext, revealAll, endReveal,
  activeFunMode,
  startRoulette, stopRoulette,
  bombCountdown, bombBoom, startRandombomb, cancelRandombomb,
  startMusikkstoler,
  startMakkerbytte,
  spotlightSlotKey, startSpotlight, dismissSpotlight,
}) {
```

**Step 2: Bygg om Fun mode-skuffen til seks kort**

Erstatt hele blokken fra `{showFunDrawer && (` til den tilhørende avsluttende `)}`
(linje 79-103) med:

```jsx
          {showFunDrawer && (
            <div className="flex flex-col gap-3 pl-2 ml-1 border-l-2 border-pink-500/30">
              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-masks-theater text-cyan-400"></i> Gradvis avdekking
                </p>
                {!revealMode ? (
                  <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-bold" onClick={startReveal} disabled={!!activeFunMode}>
                    <i className="fa-solid fa-eye-slash"></i> Start avdekking
                  </button>
                ) : (
                  <>
                    <p className="text-[10px] text-center text-cyan-300 font-semibold">{revealedCount} av {revealTotal} avslørt</p>
                    <button className="btn btn-xs bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-bold" onClick={revealNext} disabled={revealedCount >= revealTotal}>
                      <i className="fa-solid fa-eye"></i> Avslør neste
                    </button>
                    <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={revealAll} disabled={revealedCount >= revealTotal}>
                      Avslør alle
                    </button>
                    <button className="btn btn-xs btn-ghost text-slate-400 hover:text-white" onClick={endReveal}>
                      <i className="fa-solid fa-xmark"></i> Avslutt avdekking
                    </button>
                  </>
                )}
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-dice text-amber-400"></i> Roulette
                </p>
                {activeFunMode === 'roulette' ? (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-white gap-2 font-bold" onClick={stopRoulette}>
                    <i className="fa-solid fa-stop"></i> Stopp
                  </button>
                ) : (
                  <button className="btn btn-xs bg-amber-600 hover:bg-amber-500 text-white gap-2 font-bold" onClick={startRoulette} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start roulette
                  </button>
                )}
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-bomb text-rose-400"></i> Randombomb
                </p>
                {activeFunMode === 'randombomb' ? (
                  <>
                    <p className="text-[10px] text-center text-rose-300 font-semibold">{bombBoom ? 'BOOM!' : `Nedtelling: ${bombCountdown}`}</p>
                    <button className="btn btn-xs btn-outline border-slate-700 text-slate-300 hover:bg-slate-800" onClick={cancelRandombomb} disabled={bombBoom}>
                      <i className="fa-solid fa-xmark"></i> Avbryt
                    </button>
                  </>
                ) : (
                  <button className="btn btn-xs bg-rose-600 hover:bg-rose-500 text-white gap-2 font-bold" onClick={startRandombomb} disabled={!!activeFunMode || revealMode}>
                    <i className="fa-solid fa-play"></i> Start randombomb
                  </button>
                )}
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-music text-lime-400"></i> Musikkstoler
                </p>
                <button className="btn btn-xs bg-lime-600 hover:bg-lime-500 text-white gap-2 font-bold" onClick={startMusikkstoler} disabled={!!activeFunMode || revealMode}>
                  <i className="fa-solid fa-shuffle"></i> Stokk raskt
                </button>
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-people-group text-fuchsia-400"></i> Makkerbytte
                </p>
                <button className="btn btn-xs bg-fuchsia-600 hover:bg-fuchsia-500 text-white gap-2 font-bold" onClick={startMakkerbytte} disabled={!!activeFunMode || revealMode} title="Bytter kun elever i pulter som har en makkergruppe-farge">
                  <i className="fa-solid fa-shuffle"></i> Bytt om grupper
                </button>
              </div>

              <div className="h-px bg-slate-800/40"></div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 leading-tight px-1 flex items-center gap-1.5">
                  <i className="fa-solid fa-star text-yellow-400"></i> Trekk en elev
                </p>
                <button className="btn btn-xs bg-yellow-600 hover:bg-yellow-500 text-white gap-2 font-bold" onClick={startSpotlight} disabled={!!activeFunMode || revealMode}>
                  <i className="fa-solid fa-wand-sparkles"></i> Trekk elev
                </button>
                {spotlightSlotKey && (
                  <button className="btn btn-xs btn-ghost text-slate-400 hover:text-white" onClick={dismissSpotlight}>
                    <i className="fa-solid fa-xmark"></i> Fjern uthevning
                  </button>
                )}
              </div>
            </div>
          )}
```

**Step 3: Koble alle props i `SeatingChart.jsx`**

Finn `<Toolbar ... />`-kallet i `SeatingChart.jsx` og pass med alle props'ene lagt til i
Task 4-8 (samle dem her hvis de ble lagt til stykkevis):

```jsx
          <Toolbar
            unplacedStudents={unplacedStudents}
            showStudentDrawer={showStudentDrawer} setShowStudentDrawer={setShowStudentDrawer}
            showGroupDrawer={showGroupDrawer} setShowGroupDrawer={setShowGroupDrawer} activeGroupId={activeGroupId} setActiveGroupId={setActiveGroupId} GROUP_COLORS={GROUP_COLORS}
            showFunDrawer={showFunDrawer} setShowFunDrawer={setShowFunDrawer}
            hideGroups={hideGroups} setHideGroups={setHideGroups}
            handleRuleBasedFunSpin={handleRuleBasedFunSpin} handleAutoFill={handleAutoFill} flipRoom={flipRoom} handlePrint={handlePrint}
            showHistory={showHistory} setShowHistory={setShowHistory}
            showNumbers={showNumbers} setShowNumbers={setShowNumbers}
            showZones={showZones} setShowZones={setShowZones}
            hideSensitiveInfo={hideSensitiveInfo} setHideSensitiveInfo={setHideSensitiveInfo}
            setIsProjectorMode={setIsProjectorMode}
            revealMode={revealMode} revealedCount={revealedSlots.size} revealTotal={revealOrder.length} startReveal={startReveal} revealNext={revealNext} revealAll={revealAll} endReveal={endReveal}
            activeFunMode={activeFunMode}
            startRoulette={startRoulette} stopRoulette={stopRoulette}
            bombCountdown={bombCountdown} bombBoom={bombBoom} startRandombomb={startRandombomb} cancelRandombomb={cancelRandombomb}
            startMusikkstoler={startMusikkstoler}
            startMakkerbytte={startMakkerbytte}
            spotlightSlotKey={spotlightSlotKey} startSpotlight={startSpotlight} dismissSpotlight={dismissSpotlight}
          />
```

> Merk: sjekk det eksisterende kallet før du limer inn — behold eventuelle props som
> allerede står der (f.eks. `revealedCount`/`revealTotal` kan allerede være koblet med
> andre uttrykk). Målet er at ALLE props Toolbar sin signatur nå ber om, faktisk blir
> sendt inn.

**Step 4: Verifiser kompilering**

Run: `npx vite build`
Expected: bygger uten feil.

**Step 5: Full manuell gjennomkjøring i appen**

Kjør HELE test-listen fra design-dokumentets "Testing"-seksjon
(`docs/plans/2026-07-28-flere-fun-modes-design.md`):

- Regel-respekt for Randomiser/Plasser alle/Roulette/Randombomb/Musikkstoler/Makkerbytte.
- Roulette: automatisk gjennomkjøring + "Stopp" midtveis.
- Randombomb: nedtelling, flimring, boom, avbryt.
- Musikkstoler: rask, korrekt sluttresultat.
- Makkerbytte: kun fargede pulter endres.
- Spotlight: kun plasserte elever trekkes, glød flytter seg riktig.
- Låste seter urørt i ALLE modiene.
- Kun én fun mode kan kjøre om gangen (de andre knappene er disabled mens én kjører).

**Step 6: Commit**

```bash
git add src/components/SeatingChart/Toolbar.jsx src/components/SeatingChart.jsx
git commit -m "feat: UI for de fem nye fun modes i verktøypanelet"
```

---

## Task 10: CHANGELOG og avsluttende sjekk

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Legg til en changelog-oppføring**

Følg samme format som eksisterende oppføringer øverst i `CHANGELOG.md` (dato + kort
overskrift, deretter punkter om hva som var galt/nytt og hvordan det ble verifisert).
Nevn eksplisitt at regelmotoren var ikke-fungerende før denne endringen (samme stil som
"Hent fra rom"-oppføringen fra 2026-07-27), og list opp de fem nye fun modes.

**Step 2: Kjør full build én siste gang**

Run: `npx vite build`
Expected: bygger uten feil.

Run: `npm test`
Expected: alle tester i `test/seatingSolver.test.mjs` PASS.

**Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for fungerende regelmotor + fem nye fun modes"
```

---

## Ikke i scope (gjentatt fra design-dokumentet)

- "Husk forrige trukket elev" / no-repeat-logikk i Spotlight.
- Justerbar animasjonshastighet fra UI.
- Endringer i regel-redigeringen i `ClassManager.jsx`.
- Lyd-effekter.
- Låsing/opplåsing av seter MENS en fun mode kjører (kan gi et avvik mellom beregnet
  sluttresultat og faktisk lås-status — ikke håndtert, anses som en akseptabel
  begrensning siden det er en uvanlig handling å gjøre midt i en animasjon).
