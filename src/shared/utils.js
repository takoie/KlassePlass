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
 * Kanonisk versjon — brukes av chartHelpers.js, seating-setup.js og classes.js.
 */
export function normalizeStudents(arr) {
  return (Array.isArray(arr) ? arr : []).map((s, i) => {
    if (typeof s === 'string') return { id: `s-${i}-${s.replace(/\s/g, '')}`, name: s, note: '', placement: null };
    return { placement: null, note: '', ...s, id: s.id ?? `s-${i}`, name: s.name ?? String(s) };
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
 * Ekstraher nabopar fra en desk-layout basert på koordinat-nærhet.
 * To pulter regnes som naboer hvis |dx| ≤ dxThreshold OG |dy| ≤ dyThreshold.
 * Returnerer: [["Ola", "Kari"], ...] — alle unike par mellom elever på naboborger.
 * Inkluderer også elever som deler samme pult (multi-slot desks).
 */
export function extractNeighborsFromLayout(desks, studentsById, dxThreshold = 110, dyThreshold = 75) {
  const placed = desks.filter(d =>
    (d.slots ?? []).some(s => s?.studentId && studentsById[s.studentId])
  );
  const neighbors = [];
  const seen = new Set();

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      if (Math.abs(a.x - b.x) > dxThreshold || Math.abs(a.y - b.y) > dyThreshold) continue;
      const namesA = (a.slots ?? [])
        .filter(s => s?.studentId && studentsById[s.studentId])
        .map(s => studentsById[s.studentId].name);
      const namesB = (b.slots ?? [])
        .filter(s => s?.studentId && studentsById[s.studentId])
        .map(s => studentsById[s.studentId].name);
      for (const na of namesA) {
        for (const nb of namesB) {
          const key = [na, nb].sort().join('|');
          if (!seen.has(key)) { seen.add(key); neighbors.push([na, nb].sort()); }
        }
      }
    }
    // Also record pairs within the same multi-slot desk as neighbors
    const slotNames = (placed[i].slots ?? [])
      .filter(s => s?.studentId && studentsById[s.studentId])
      .map(s => studentsById[s.studentId].name);
    for (let x = 0; x < slotNames.length; x++) {
      for (let y = x + 1; y < slotNames.length; y++) {
        const key = [slotNames[x], slotNames[y]].sort().join('|');
        if (!seen.has(key)) { seen.add(key); neighbors.push([slotNames[x], slotNames[y]].sort()); }
      }
    }
  }
  return neighbors;
}

/**
 * Returnerer modal-portalen (#modal-portal).
 * Alle modaler og context-menyer legges hit slik at de aldri
 * klippes av overflow:hidden inne i #app.
 */
export function getPortal() {
  return document.getElementById('modal-portal') ?? document.body;
}

/**
 * Bekreftelsesdialog som matcher KlassePlass-designet.
 * Returnerer en Promise<boolean> — true hvis brukeren bekrefter.
 * @param {Object} opts
 * @param {string} opts.title       — tittel (f.eks. "Slett klassen?")
 * @param {string} opts.message     — forklarende tekst
 * @param {string} [opts.confirmLabel]  — tekst på bekreft-knapp (standard: "Ja, slett")
 * @param {string} [opts.cancelLabel]   — tekst på avbryt-knapp (standard: "Avbryt")
 * @param {boolean} [opts.danger]       — rød bekreft-knapp (standard: true)
 */
export function showConfirm({ title, message, confirmLabel = 'Ja, slett', cancelLabel = 'Avbryt', danger = true } = {}) {
  return new Promise(resolve => {
    const portal = getPortal();

    const backdrop = document.createElement('div');
    backdrop.className = 'kp-backdrop';
    backdrop.style.zIndex = '10000';

    const titleId = 'kp-confirm-title';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', titleId);

    backdrop.innerHTML = `
      <div class="kp-modal" style="max-width:400px">
        <div class="modal-header">
          <span class="modal-title" id="${titleId}">${title ?? ''}</span>
        </div>
        ${message ? `<p style="font-size:13px;color:oklch(var(--bc)/0.7);margin-bottom:4px;line-height:1.5">${message}</p>` : ''}
        <div class="modal-footer">
          <button class="btn btn-ghost btn-sm" id="kp-confirm-cancel">${cancelLabel}</button>
          <button class="btn btn-sm ${danger ? 'btn-error' : 'btn-primary'}" id="kp-confirm-ok">${confirmLabel}</button>
        </div>
      </div>`;

    const close = (result) => {
      backdrop.remove();
      resolve(result);
    };

    backdrop.querySelector('#kp-confirm-cancel').addEventListener('click', () => close(false));
    backdrop.querySelector('#kp-confirm-ok').addEventListener('click', () => close(true));
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(false); });

    portal.appendChild(backdrop);
    focusAfterRender(backdrop.querySelector('#kp-confirm-cancel'));
  });
}

/**
 * Fokuserer et element etter neste render-syklus.
 * Bruk i stedet for ad-hoc setTimeout(() => el?.focus(), 50).
 * @param {HTMLElement|null|undefined} el
 */
export function focusAfterRender(el) {
  setTimeout(() => el?.focus(), 50);
}

/** Toast-melding i UI */
export function showToast(message, type = 'info') {
  const portal = getPortal();
  const existing = document.getElementById('toast-container');
  const container = existing ?? (() => {
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.setAttribute('aria-live', 'polite');
    c.setAttribute('aria-atomic', 'true');
    portal.appendChild(c);
    return c;
  })();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
