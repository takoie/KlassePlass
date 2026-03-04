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

  // Bygg navn → id map for oppslag
  const idByName = {};
  for (const s of Object.values(studentsById)) {
    idByName[s.name] = s.id;
  }

  const deskByStudent = buildDeskByStudent(desks);
  const violations = [];

  for (const c of constraints) {
    const idA = idByName[c.student_a];
    const idB = idByName[c.student_b];
    if (!idA || !idB) continue; // Elev finnes ikke i klassen

    const deskA = deskByStudent[idA];
    const deskB = deskByStudent[idB];
    const sameDeskOrUnplaced = deskA && deskB && deskA === deskB;

    if (c.type === 'always_together' && !sameDeskOrUnplaced) {
      violations.push(`${c.student_a} og ${c.student_b} må sitte på samme bord`);
    } else if (c.type === 'never_together' && sameDeskOrUnplaced) {
      violations.push(`${c.student_a} og ${c.student_b} skal ikke sitte på samme bord`);
    }
  }

  return { valid: violations.length === 0, violations };
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
