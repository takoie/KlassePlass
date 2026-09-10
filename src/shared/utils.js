/**
 * Generelle hjelpefunksjoner.
 */

/** Generer en enkel UUID (ikke kryptografisk sikker, men god nok for desk IDs) */
export function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Blander en hex-farge mot hvitt med `amount` (0 = uendret, 1 = ren hvit).
 * Brukes til å lage en lysere fyll-tone av makkergruppe-fargen på pulter/
 * elevnavn, slik at den mer mettede kantfargen (borderen) fortsatt skiller
 * seg synlig ut fra fyllet - se SeatingChart.jsx/SeatingChartPrintContent.jsx.
 */
export function lightenHex(hex, amount = 0.65) {
  const h = (hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const toHex = (c) => c.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
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

/**
 * Returnerer modal-portalen (#modal-portal).
 * Alle modaler og context-menyer legges hit slik at de aldri
 * klippes av overflow:hidden inne i #app.
 */
export function getPortal() {
  return document.getElementById('modal-portal') ?? document.body;
}

/**
 * Fokuserer et element etter neste render-syklus.
 * Bruk i stedet for ad-hoc setTimeout(() => el?.focus(), 50).
 * @param {HTMLElement|null|undefined} el
 */
export function focusAfterRender(el) {
  setTimeout(() => el?.focus(), 50);
}

/**
 * Toast-melding i UI.
 * @param {string} message
 * @param {string} [type='info']  — info | success | error | warning
 * @param {Object} [opts]
 * @param {string} [opts.key]     — hvis satt, erstattes en eksisterende toast med
 *   samme key i stedet for å stable en ny (f.eks. gjentatt autolagring).
 */
export function showToast(message, type = 'info', opts = {}) {
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

  if (opts.key) {
    container.querySelector(`[data-toast-key="${CSS.escape(opts.key)}"]`)?.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  if (opts.key) toast.setAttribute('data-toast-key', opts.key);
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
