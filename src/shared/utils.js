/**
 * Generelle hjelpefunksjoner.
 */

import { DESK_TYPES } from './constants.js';

/** Generer en enkel UUID (ikke kryptografisk sikker, men god nok for desk IDs) */
export function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Lager et nytt tomt desk-objekt av gitt type */
export function createDesk(type, x, y) {
  const info = DESK_TYPES[type] ?? DESK_TYPES.single;
  return {
    id: uid(),
    type,
    x, y,
    rotation: 0,
    color: 'default',
    groupId: null,
    slots: Array(info.capacity).fill(null),
  };
}

/** Snapper x/y til nærmeste grid-punkt */
export function snapToGrid(value, snap = 15) {
  return Math.round(value / snap) * snap;
}

/** Bygger en studentsById Map fra en array av { id, name, note } */
export function buildStudentsById(students) {
  return Object.fromEntries(students.map(s => [s.id, s]));
}

/**
 * Konverterer student-array fra legacy-format (bare strings) til objekt-format.
 * Eksisterende objekt-format returneres uendret.
 */
export function normalizeStudents(raw) {
  return raw.map((s, i) => {
    if (typeof s === 'string') return { id: `legacy-${i}-${s}`, name: s, note: '', placement: null };
    return { placement: null, ...s };
  });
}

/** ISO 8601 ukenummer for en dato */
export function getWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Ekstraher alle par fra en desk-layout (for historikk-lagring).
 * Returnerer: [["Ola", "Kari"], ["Per", "Lise"], ...]
 * "Par" = to elever som sitter på samme pult.
 */
export function extractPairsFromLayout(desks, studentsById) {
  const pairs = [];
  for (const desk of desks) {
    const names = (desk.slots ?? [])
      .filter(s => s && studentsById[s.studentId])
      .map(s => studentsById[s.studentId].name);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        pairs.push([names[i], names[j]].sort());
      }
    }
  }
  return pairs;
}

/**
 * Returnerer modal-portalen (#modal-portal).
 * Alle modaler og context-menyer legges hit slik at de aldri
 * klippes av overflow:hidden inne i #app.
 */
export function getPortal() {
  return document.getElementById('modal-portal') ?? document.body;
}

/** Toast-melding i UI */
export function showToast(message, type = 'info') {
  const portal = getPortal();
  const existing = document.getElementById('toast-container');
  const container = existing ?? (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    portal.appendChild(c);
    return c;
  })();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
