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

  // Beregn Y-range for plasserings-prioritering
  const allY = desks.map(d => d.y).filter(y => y != null);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const rangeY = maxY - minY || 1;
  const midY = minY + rangeY / 2;

  let bestLayout = null;
  let bestScore = Infinity;
  let bestViolations = [];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const shuffled = fisherYatesShuffle([...freeStudents]);
    const candidate = buildLayout(desks, shuffled, freeSlotPositions, lockedSlots, minY, maxY, midY);

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

function buildLayout(desks, shuffledStudents, freeSlots, lockedSlots, minY, maxY, midY) {
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

  // Skill ut studenter med plasseringspreferanser
  const prioritized = shuffledStudents.filter(s => s.placement);
  const regular     = shuffledStudents.filter(s => !s.placement);

  // Bygg en sorted kopi av freeSlots per gruppe
  const rangeY = maxY - minY || 1;
  const top20  = minY + rangeY * 0.2;
  const bot80  = minY + rangeY * 0.8;

  const slotsForStudent = (placement) => {
    const deskLookup = deskById;
    return freeSlots.filter(({ deskId }) => {
      const deskY = deskLookup[deskId]?.y ?? midY;
      if (placement === 'never-front')  return deskY >= top20;
      if (placement === 'never-back')   return deskY <= bot80;
      return true;
    }).sort((a, b) => {
      const ay = deskById[a.deskId]?.y ?? midY;
      const by = deskById[b.deskId]?.y ?? midY;
      if (placement === 'front')  return ay - by;
      if (placement === 'back')   return by - ay;
      if (placement === 'middle') return Math.abs(ay - midY) - Math.abs(by - midY);
      return 0;
    });
  };

  const usedSlots = new Set();

  // Place prioritized students first
  for (const student of prioritized) {
    const candidates = slotsForStudent(student.placement).filter(sl => {
      const key = `${sl.deskId}:${sl.slotIdx}`;
      return !usedSlots.has(key) && !deskById[sl.deskId]?.slots[sl.slotIdx];
    });
    if (candidates.length > 0) {
      const { deskId, slotIdx } = candidates[0];
      usedSlots.add(`${deskId}:${slotIdx}`);
      deskById[deskId].slots[slotIdx] = { studentId: student.id, locked: false };
    }
  }

  // Place regular students in shuffle order
  let si = 0;
  for (const { deskId, slotIdx } of freeSlots) {
    const key = `${deskId}:${slotIdx}`;
    if (usedSlots.has(key)) continue;
    if (si >= regular.length) break;
    if (deskById[deskId] && !deskById[deskId].slots[slotIdx]) {
      deskById[deskId].slots[slotIdx] = {
        studentId: regular[si].id,
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
