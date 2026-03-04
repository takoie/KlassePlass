/**
 * Randomiseringsmotor med constraint-støtte.
 * Ren funksjon — ingen side effects, ingen UI.
 */

import { DESK_TYPES } from './constants.js';
import { checkHardConstraints, scoreHistoryConflicts } from './constraints.js';

const MAX_ITERATIONS = 200;

/**
 * Randomiser elever til pulter.
 *
 * @param {Array} desks - desk-objekter (slots nullstilles)
 * @param {Array} students - [{ id, name }]
 * @param {Object} studentsById - Map<id, student>
 * @param {Object} opts
 * @param {Array}  opts.constraints    - hard constraints fra DB
 * @param {Array}  opts.historyPairs   - par fra siste N kart (soft)
 * @param {Object} opts.lockedSlots    - { [deskId]: { [slotIdx]: studentId } } — låste posisjoner
 * @returns {{ desks: Array, violations: Array<string>, historyScore: number }}
 */
export function randomizeSeating(desks, students, studentsById, opts = {}) {
  const { constraints = [], historyPairs = [], lockedSlots = {} } = opts;

  // Finn alle studenter som IKKE er låst
  const lockedStudentIds = new Set(
    Object.values(lockedSlots).flatMap(s => Object.values(s))
  );
  const freeStudents = students.filter(s => !lockedStudentIds.has(s.id));

  // Finn alle ledige (ikke-låste) slot-posisjoner
  const freeSlotPositions = [];
  for (const desk of desks) {
    const capacity = DESK_TYPES[desk.type]?.capacity ?? 1;
    for (let i = 0; i < capacity; i++) {
      const locked = lockedSlots[desk.id]?.[i];
      if (!locked) freeSlotPositions.push({ deskId: desk.id, slotIdx: i });
    }
  }

  let bestLayout = null;
  let bestScore = Infinity;
  let bestViolations = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const shuffled = fisherYatesShuffle([...freeStudents]);
    const candidate = buildLayout(desks, shuffled, freeSlotPositions, lockedSlots);

    const { valid, violations } = checkHardConstraints(candidate, studentsById, constraints);
    if (valid) {
      const score = scoreHistoryConflicts(candidate, studentsById, historyPairs);
      if (score < bestScore) {
        bestScore = score;
        bestLayout = candidate;
        bestViolations = [];
        if (score === 0) break; // Perfekt løsning
      }
    } else if (bestLayout === null) {
      // Behold siste kjente selv om den bryter constraints — som fallback
      bestLayout = candidate;
      bestViolations = violations;
    }
  }

  return {
    desks: bestLayout ?? desks,
    violations: bestViolations,
    historyScore: bestScore === Infinity ? 0 : bestScore,
  };
}

function buildLayout(desks, shuffledStudents, freeSlots, lockedSlots) {
  const result = desks.map(desk => ({
    ...desk,
    slots: Array(DESK_TYPES[desk.type]?.capacity ?? 1).fill(null),
  }));

  const deskById = Object.fromEntries(result.map(d => [d.id, d]));

  // Plasser låste studenter først
  for (const [deskId, slots] of Object.entries(lockedSlots)) {
    for (const [slotIdx, studentId] of Object.entries(slots)) {
      if (deskById[deskId]) {
        deskById[deskId].slots[parseInt(slotIdx)] = { studentId, locked: true };
      }
    }
  }

  // Plasser frie studenter
  let si = 0;
  for (const { deskId, slotIdx } of freeSlots) {
    if (si >= shuffledStudents.length) break;
    if (deskById[deskId] && !deskById[deskId].slots[slotIdx]) {
      deskById[deskId].slots[slotIdx] = {
        studentId: shuffledStudents[si].id,
        locked: false,
      };
      si++;
    }
  }

  return result;
}

function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
