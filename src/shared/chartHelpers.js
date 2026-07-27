/**
 * chartHelpers.js — Hjelpefunksjoner for klassekart (lastin/normalisering).
 */

import { buildStudentsById, uid, normalizeStudents } from './utils.js';
import { DESK_TYPES } from './constants.js';

export { normalizeStudents };

export function parseJSON(str) {
  if (!str) return null;
  try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return null; }
}

export function normalizeDeskSlots(desks, students) {
  return desks.map(desk => {
    let slots = desk.slots;
    if (!slots) {
      const legacyStudents = desk.students ?? (desk.student ? [desk.student] : []);
      slots = legacyStudents.map(s => {
        if (!s) return null;
        const name = typeof s === 'string' ? s : s.name;
        const found = students.find(st => st.name === name);
        return found ? { studentId: found.id, locked: s.locked ?? false } : null;
      });
    }
    const capacity = DESK_TYPES[desk.type]?.capacity ?? 1;
    // Ensure slots length matches capacity
    while (slots.length < capacity) slots.push(null);
    return { ...desk, id: desk.id ?? uid(), slots: slots.slice(0, capacity) };
  });
}

export async function buildChartFromParams(params) {
  const students = normalizeStudents(params.students);
  const studentsById = buildStudentsById(students);
  return {
    id: null,
    name: params.name,
    classId: params.classId,
    roomId: params.roomId,
    desks: params.desks.map(d => ({
      ...d,
      id: d.id ?? uid(),
      slots: Array(DESK_TYPES[d.type]?.capacity ?? 1).fill(null),
    })),
    students,
    studentsById,
    roomDesignMode: params.roomDesignMode ?? 'board-top',
    roomHeight: params.roomHeight ?? 500,
    decorations: params.decorations ?? [],
    flipForDisplay: params.flipForDisplay ?? false,
    avoidLastN: params.avoidLastN ?? 3,
    constraints: [],
  };
}

export async function buildChartFromDb(raw, getClassFn) {
  const layout   = parseJSON(raw.placements) ?? [];
  const cls      = await getClassFn(raw.class_id);
  const rawStudents = parseJSON(cls?.students) ?? [];
  const students = normalizeStudents(Array.isArray(rawStudents) ? rawStudents : String(rawStudents).split('\n').filter(Boolean));
  const studentsById = buildStudentsById(students);

  return {
    id: raw.id,
    name: raw.name,
    classId: raw.class_id,
    roomId: raw.room_id,
    comment: raw.comment ?? '',
    desks: normalizeDeskSlots(layout, students),
    students,
    studentsById,
    roomDesignMode: raw.design_mode ?? 'board-top',
    roomHeight: raw.room_height ?? 500,
    decorations: raw.decorations ? parseJSON(raw.decorations) : [],
    flipForDisplay: false,
    avoidLastN: 3,
    constraints: [],
  };
}
