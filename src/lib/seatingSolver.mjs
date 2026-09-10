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

// Bygger oppslags-hjelperne som regel-sjekkene trenger, mot én kandidat-plassering.
function buildRuleCtx(candidatePlacements, desks) {
  const deskIdForSlot = (slotKey) => slotKey.split('_seat_')[0];
  const deskForStudent = (studentId) => {
    const slotKey = Object.keys(candidatePlacements).find(k => candidatePlacements[k] === studentId);
    if (!slotKey) return null;
    return (desks || []).find(d => d.id === deskIdForSlot(slotKey)) || null;
  };
  const hasZone = (desk, zone) => !!desk && Array.isArray(desk.zones) && desk.zones.includes(zone);
  return { deskForStudent, hasZone };
}

/**
 * Antall regelbrudd for én regel mot en plassering (0 = oppfylt). For sone-
 * regler telles ett brudd per elev som er feil plassert (samme vekting som før);
 * for avoid/pair er det 0 eller 1. Delt mellom scoreClassPlacement (ganges med
 * prioritets-straff) og evaluateRules (> 0 => regelen er brutt).
 */
export function ruleViolationCount(rule, ctx) {
  const ids = rule.studentIds || [];
  const { deskForStudent, hasZone } = ctx;
  const zoneMiss = (zone, want) =>
    ids.reduce((n, id) => n + (hasZone(deskForStudent(id), zone) === want ? 0 : 1), 0);

  switch (rule.type) {
    case 'avoid': {
      const deskIds = ids.map(deskForStudent).filter(Boolean).map(d => d.id);
      return (deskIds.length > 1 && new Set(deskIds).size < deskIds.length) ? 1 : 0;
    }
    case 'pair':
    case 'supportPair': {
      if (ids.length < 2) return 0;
      const a = deskForStudent(ids[0]);
      const b = deskForStudent(ids[1]);
      return (a && b && a.id !== b.id) ? 1 : 0;
    }
    case 'nearBoard':  return zoneMiss('front', true);
    case 'sitBack':    return zoneMiss('back', true);
    case 'sitMiddle':  return zoneMiss('center', true);
    case 'awayDoor':   return zoneMiss('door', false);
    case 'awayWindow': return zoneMiss('window', false);
    default:           return 0;
  }
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
  const ctx = buildRuleCtx(candidatePlacements, desks);

  (classRules || []).forEach(rule => {
    if (!rule || !rule.type) return;
    const penalty = PRIORITY_PENALTY[rule.priority] ?? PRIORITY_PENALTY.important;
    score -= penalty * ruleViolationCount(rule, ctx);
  });

  return score;
}

/**
 * Rapport om hvilke regler en plassering oppfyller/bryter. Samme sjekk som
 * scoreClassPlacement, men boolsk per regel og med elevnavn til visning.
 * @returns {{ total: number, satisfied: number, violations: Array<{rule: object, studentNames: string[]}> }}
 */
export function evaluateRules(candidatePlacements, classRules, desks, students = []) {
  const nameById = new Map((students || []).map(s => [s.id, s.name]));
  const ctx = buildRuleCtx(candidatePlacements, desks);
  const rules = (classRules || []).filter(r => r && r.type);

  const violations = [];
  for (const rule of rules) {
    if (ruleViolationCount(rule, ctx) > 0) {
      violations.push({
        rule,
        studentNames: (rule.studentIds || []).map(id => nameById.get(id) || id),
      });
    }
  }
  return { total: rules.length, satisfied: rules.length - violations.length, violations };
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

  // Filtrer bort studenter som allerede er plassert i basePlacements (f.eks. låste seter),
  // slik at låste elever aldri dupliseres over på andre seter.
  const placedStudentIds = new Set(Object.values(basePlacements));
  const studentsToPlace = students.filter(st => !placedStudentIds.has(st.id) && !placedStudentIds.has(st.name));

  for (let attempt = 0; attempt < attempts; attempt++) {
    const testPlacements = { ...basePlacements };
    const shuffledStudents = shuffle(studentsToPlace);
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
