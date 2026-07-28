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
