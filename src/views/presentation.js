/**
 * presentation.js — Fullscreen presentasjonsvindu med trekk-animasjoner.
 */

import { renderDesks } from '../shared/renderDesks.js';
import { createDrawAnimation } from '../shared/animate.js';
import { CANVAS_W } from '../shared/constants.js';

let _data = null;
let _zoom = 1;
let _showNames = true;
let _showNumbers = false;
let _highContrast = false;
let _drawAnim = null;

export function init(ipcRenderer) {
  ipcRenderer.on('render-layout', (_, data) => {
    _data = data;
    render();
  });

  ipcRenderer.on('presentation-cmd', (_, cmd) => {
    if (cmd === 'next')     _drawAnim?.next();
    if (cmd === 'show-all') _drawAnim?.showAll();
    if (cmd === 'reset')    resetDraw();
  });

  bindUI();
}

function render() {
  if (!_data) return;

  const canvas = document.getElementById('pres-canvas');
  if (!canvas) return;

  canvas.style.width    = '920px';
  canvas.style.minHeight = (_data.roomHeight ?? 500) + 40 + 'px';

  const board = document.getElementById('pres-board');
  const atBottom = _data.flipForDisplay || _data.roomDesignMode === 'board-bottom';
  board?.classList.toggle('board-bottom', atBottom);
  board?.classList.toggle('board-top', !atBottom);

  renderDesks(canvas, _data.desks, _data.studentsById, {
    interactive: false,
    showNames: _showNames,
    showNumbers: _showNumbers,
    showGroups: false,
    hideIcons: true,
  });

  renderDecorations(canvas);
  updateZoom();

  // Chart name
  const nameEl = document.getElementById('pres-chart-name');
  if (nameEl) nameEl.textContent = _data.chartName ?? '';
}

function renderDecorations(canvas) {
  [...canvas.querySelectorAll('.decoration')].forEach(el => el.remove());
  (_data?.decorations ?? []).forEach(deco => {
    const el = document.createElement('div');
    el.className = `decoration decoration-${deco.type}`;

    let x = deco.x, y = deco.y;
    let rot = deco.rotation ?? 0;

    if (_data?.flipForDisplay) {
      x = CANVAS_W - deco.x - deco.width;
      y = (_data.roomHeight ?? 500) - deco.y - deco.height;
      rot = (rot + 180) % 360;
    }

    el.style.cssText = `left:${x}px;top:${y}px;width:${deco.width}px;height:${deco.height}px;pointer-events:none`;
    el.style.transform = `rotate(${rot}deg)`;
    if (deco.label) el.textContent = deco.label;
    canvas.appendChild(el);
  });
}

function updateZoom() {
  const canvas = document.getElementById('pres-canvas');
  const outer  = document.getElementById('canvas-outer');
  if (!canvas || !outer) return;
  canvas.style.transformOrigin = 'top center';
  const rotPart = (_data?.flipForDisplay) ? ' rotate(180deg)' : '';
  canvas.style.transform = `scale(${_zoom})${rotPart}`;
  // Sett høyde slik at outer scroller riktig
  outer.style.alignItems = _zoom > 1 ? 'flex-start' : 'center';
}

/* ---- Trekk-animasjon ---- */

function startDraw() {
  if (!_data) return;

  const canvas = document.getElementById('pres-canvas');
  // Skjul alle elevnavn
  canvas.querySelectorAll('.student-name').forEach(el => { el.style.opacity = '0'; });

  // Bygg assignments i tilfeldig rekkefølge
  const assignments = [];
  _data.desks.forEach(desk => {
    const deskEl = canvas.querySelector(`[data-desk-id="${desk.id}"]`);
    if (!deskEl) return;
    (desk.slots ?? []).forEach(slot => {
      if (!slot) return;
      const student = _data.studentsById[slot.studentId];
      if (student) assignments.push({ studentName: student.name, deskEl });
    });
  });

  // Bland
  for (let i = assignments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [assignments[i], assignments[j]] = [assignments[j], assignments[i]];
  }

  _drawAnim = createDrawAnimation(assignments, {
    delayBetween: 1500,
    onComplete: () => {
      document.getElementById('btn-draw-next')?.classList.add('hidden');
      document.getElementById('btn-draw-all')?.classList.add('hidden');
    }
  });

  document.getElementById('btn-draw-start')?.classList.add('hidden');
  document.getElementById('btn-draw-next')?.classList.remove('hidden');
  document.getElementById('btn-draw-all')?.classList.remove('hidden');
}

function resetDraw() {
  _drawAnim?.cancel();
  _drawAnim = null;
  document.getElementById('btn-draw-start')?.classList.remove('hidden');
  document.getElementById('btn-draw-next')?.classList.add('hidden');
  document.getElementById('btn-draw-all')?.classList.add('hidden');
  render();
}

/* ---- UI-binding ---- */

function bindUI() {
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => { _zoom = Math.min(_zoom + 0.1, 2); updateZoom(); });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => { _zoom = Math.max(_zoom - 0.1, 0.4); updateZoom(); });
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => { _zoom = 1; updateZoom(); });

  document.getElementById('btn-toggle-names')?.addEventListener('click', () => {
    _showNames = !_showNames;
    document.getElementById('btn-toggle-names')?.classList.toggle('active', _showNames);
    render();
  });
  document.getElementById('btn-toggle-numbers')?.addEventListener('click', () => {
    _showNumbers = !_showNumbers;
    render();
  });
  document.getElementById('btn-high-contrast')?.addEventListener('click', () => {
    _highContrast = !_highContrast;
    document.body.classList.toggle('high-contrast', _highContrast);
    document.getElementById('btn-high-contrast')?.classList.toggle('active', _highContrast);
  });

  document.getElementById('btn-draw-start')?.addEventListener('click', startDraw);
  document.getElementById('btn-draw-next')?.addEventListener('click', () => _drawAnim?.next());
  document.getElementById('btn-draw-all')?.addEventListener('click', () => _drawAnim?.showAll());
  document.getElementById('btn-close')?.addEventListener('click', () => window.close());

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') _drawAnim?.next();
    if (e.key === 'Escape') window.close();
    if (e.key === '+' || e.key === '=') { _zoom = Math.min(_zoom + 0.1, 2); updateZoom(); }
    if (e.key === '-') { _zoom = Math.max(_zoom - 0.1, 0.4); updateZoom(); }
  });

  // Auto-skjul verktøylinje ved inaktivitet
  let hideTimer;
  const toolbar = document.getElementById('pres-toolbar');
  document.addEventListener('mousemove', () => {
    toolbar?.classList.remove('hidden-toolbar');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => toolbar?.classList.add('hidden-toolbar'), 3000);
  });
}
