/**
 * Constraint-sjekk og historikk-analyse for randomisering.
 * Håndterer hard constraints (alltid/aldri) og soft constraints (historikk).
 */

/**
 * Sjekk om en gitt student-til-pult-assignment bryter hard constraints.
 *
 * @param {Array} desks - desk-objekter med slots fylt med studentId
 * @param {Object} studentsById - Map<id, { name }>
 * @param {Array} constraints - [{ type, student_a, student_b }]
 * @returns {{ valid: boolean, violations: Array<string> }}
 */
export function checkHardConstraints(desks, studentsById, constraints) {
  const violations = [];

  for (const c of constraints) {
    const together = areStudentsTogether(desks, studentsById, c.student_a, c.student_b);

    if (c.type === 'always_together' && !together) {
      violations.push(`${c.student_a} og ${c.student_b} skal alltid sitte sammen`);
    }
    if (c.type === 'never_together' && together) {
      violations.push(`${c.student_a} og ${c.student_b} skal aldri sitte sammen`);
    }
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Beregn "historikk-score" for en layout — lavere er bedre.
 * Teller antall par som er gjentatt fra historikk.
 *
 * @param {Array} desks - desk-objekter med slots
 * @param {Object} studentsById - Map<id, { name }>
 * @param {Array} historyPairs - [["Ola","Kari"], ...] fra siste N kart
 * @returns {number} antall gjentatte par
 */
export function scoreHistoryConflicts(desks, studentsById, historyPairs) {
  const historyset = new Set(historyPairs.map(p => pairKey(p[0], p[1])));
  let score = 0;
  for (const desk of desks) {
    const names = slotsToNames(desk, studentsById);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        if (historyset.has(pairKey(names[i], names[j]))) score++;
      }
    }
  }
  return score;
}

/** Sjekk om to spesifikke elever sitter på samme pult */
function areStudentsTogether(desks, studentsById, nameA, nameB) {
  for (const desk of desks) {
    const names = slotsToNames(desk, studentsById);
    if (names.includes(nameA) && names.includes(nameB)) return true;
  }
  return false;
}

function slotsToNames(desk, studentsById) {
  return (desk.slots ?? [])
    .filter(s => s && studentsById[s.studentId])
    .map(s => studentsById[s.studentId].name);
}

function pairKey(a, b) {
  return [a, b].sort().join('|||');
}

/**
 * Bygg soft constraints fra historikk — returnerer et Set av parnøkler.
 */
export function buildHistorySet(historyEntries) {
  const pairs = historyEntries.flatMap(e => {
    try { return JSON.parse(e.pairs); } catch { return []; }
  });
  return new Set(pairs.map(p => pairKey(p[0], p[1])));
}
