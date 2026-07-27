/**
 * constraints.js — Hard-constraint sjekk og historikk-scoring.
 * Rene funksjoner, ingen side effects.
 */

/**
 * Bygg et kart: deskId per studentId fra en ferdig layout.
 */
function buildDeskByStudent(desks) {
  const map = {};
  for (const desk of desks) {
    for (const slot of desk.slots ?? []) {
      if (slot?.studentId) map[slot.studentId] = desk.id;
    }
  }
  return map;
}

/**
 * Bygg et kart: Y-koordinat per deskId.
 */
function buildDeskYById(desks) {
  const map = {};
  for (const desk of desks) map[desk.id] = desk.y ?? 0;
  return map;
}

/**
 * Bygg et kart: X-koordinat per deskId.
 */
function buildDeskXById(desks) {
  const map = {};
  for (const desk of desks) map[desk.id] = desk.x ?? 0;
  return map;
}

/**
 * Beregn median Y blant alle desks.
 */
function medianDeskY(desks) {
  const ys = desks.map(d => d.y ?? 0).sort((a, b) => a - b);
  if (!ys.length) return 0;
  const mid = Math.floor(ys.length / 2);
  return ys.length % 2 !== 0 ? ys[mid] : (ys[mid - 1] + ys[mid]) / 2;
}

/**
 * Sjekk hard-constraints mot en kandidat-layout.
 *
 * Constraints bruker student-navn (slik de er lagret i DB).
 * studentsById = { [id]: { id, name, ... } }
 *
 * @param {Array}  desks         - Desk-array med slots
 * @param {Object} studentsById  - Map id → student
 * @param {Array}  constraints   - [{ student_a, student_b, type }]
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function checkHardConstraints(desks, studentsById, constraints) {
  if (!constraints || constraints.length === 0) return { valid: true, violations: [] };

  const idByName = {};
  for (const s of Object.values(studentsById)) idByName[s.name] = s.id;

  const deskByStudent = buildDeskByStudent(desks);
  const deskYById     = buildDeskYById(desks);
  const deskXById     = buildDeskXById(desks);
  const midY          = medianDeskY(desks);
  const violations    = [];
  const ROW_TOL       = 40;
  const COL_TOL       = 40;

  for (const c of constraints) {
    const idA = idByName[c.student_a];
    const idB = idByName[c.student_b];
    if (!idA || !idB) continue;

    const deskA = deskByStudent[idA];
    const deskB = deskByStudent[idB];
    const sameDeskOrUnplaced = deskA && deskB && deskA === deskB;

    if (c.type === 'always_together' && !sameDeskOrUnplaced) {
      violations.push(`${c.student_a} og ${c.student_b} må sitte på samme bord`);
    } else if (c.type === 'never_together' && sameDeskOrUnplaced) {
      violations.push(`${c.student_a} og ${c.student_b} skal ikke sitte på samme bord`);
    } else if (c.type === 'opposite_side') {
      if (!deskA || !deskB) continue;
      const sameHalf = (deskYById[deskA] < midY) === (deskYById[deskB] < midY);
      if (sameHalf) violations.push(`${c.student_a} og ${c.student_b} skal sitte på motsatt side av klasserommet`);
    } else if (c.type === 'same_row') {
      if (!deskA || !deskB) continue;
      if (Math.abs((deskYById[deskA] ?? 0) - (deskYById[deskB] ?? 0)) > ROW_TOL) {
        violations.push(`${c.student_a} og ${c.student_b} skal sitte på samme rad`);
      }
    } else if (c.type === 'same_column') {
      if (!deskA || !deskB) continue;
      if (Math.abs((deskXById[deskA] ?? 0) - (deskXById[deskB] ?? 0)) > COL_TOL) {
        violations.push(`${c.student_a} og ${c.student_b} skal sitte i samme kolonne`);
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Returner et Set med desk-IDer som er involvert i aktive violations.
 */
export function getViolatingDeskIds(desks, studentsById, constraints) {
  if (!constraints || constraints.length === 0) return new Set();

  const idByName = {};
  for (const s of Object.values(studentsById)) idByName[s.name] = s.id;

  const deskByStudent = buildDeskByStudent(desks);
  const deskYById     = buildDeskYById(desks);
  const deskXById     = buildDeskXById(desks);
  const midY          = medianDeskY(desks);
  const violatingIds  = new Set();
  const ROW_TOL       = 40;
  const COL_TOL       = 40;

  for (const c of constraints) {
    const idA = idByName[c.student_a];
    const idB = idByName[c.student_b];
    if (!idA || !idB) continue;

    const deskA = deskByStudent[idA];
    const deskB = deskByStudent[idB];
    const sameDeskOrUnplaced = deskA && deskB && deskA === deskB;

    if (c.type === 'never_together' && sameDeskOrUnplaced) {
      violatingIds.add(deskA);
    } else if (c.type === 'always_together' && deskA && deskB && !sameDeskOrUnplaced) {
      violatingIds.add(deskA);
      violatingIds.add(deskB);
    } else if (c.type === 'opposite_side' && deskA && deskB) {
      const sameHalf = (deskYById[deskA] < midY) === (deskYById[deskB] < midY);
      if (sameHalf) { violatingIds.add(deskA); violatingIds.add(deskB); }
    } else if (c.type === 'same_row' && deskA && deskB) {
      if (Math.abs((deskYById[deskA] ?? 0) - (deskYById[deskB] ?? 0)) > ROW_TOL) {
        violatingIds.add(deskA);
        violatingIds.add(deskB);
      }
    } else if (c.type === 'same_column' && deskA && deskB) {
      if (Math.abs((deskXById[deskA] ?? 0) - (deskXById[deskB] ?? 0)) > COL_TOL) {
        violatingIds.add(deskA);
        violatingIds.add(deskB);
      }
    }
  }

  return violatingIds;
}

/**
 * Tell opp historikk-konflikter (myke constraints).
 * historyPairs = [["Navn A", "Navn B"], ...] — par fra siste N kart.
 *
 * @param {Array}  desks        - Desk-array med slots
 * @param {Object} studentsById - Map id → student
 * @param {Array}  historyPairs - [["navn1","navn2"], ...]
 * @returns {number} Antall gjentatte par (lavere er bedre)
 */
export function scoreHistoryConflicts(desks, studentsById, historyPairs) {
  if (!historyPairs || historyPairs.length === 0) return 0;

  // Normaliser historikk-par til Set med sorterte nøkler
  const historySet = new Set(
    historyPairs.map(([a, b]) => [a, b].sort().join('|'))
  );

  let conflicts = 0;
  for (const desk of desks) {
    const names = (desk.slots ?? [])
      .filter(s => s?.studentId && studentsById[s.studentId])
      .map(s => studentsById[s.studentId].name);

    // Sjekk alle par på dette bordet mot historikk
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join('|');
        if (historySet.has(key)) conflicts++;
      }
    }
  }

  return conflicts;
}
