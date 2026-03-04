/**
 * seating-editor.js — Interaktiv klassekarteditor.
 * Inneholder: shuffle, drag-swap, lock/unlock, notater, gruppefarger,
 * pultnumre, pultfarger, unplaced-dock og kontekstmenyer.
 */

import { renderDesks }        from '../shared/renderDesks.js';
import { randomizeSeating }   from '../shared/randomize.js';
import { getDisplayDesks }    from '../shared/transforms.js';
import { DESK_COLORS }        from '../shared/constants.js';
import { extractPairsFromLayout, showToast } from '../shared/utils.js';
import { showContextMenu }    from '../shared/contextMenu.js';
import { buildChartFromParams, buildChartFromDb } from '../shared/chartHelpers.js';

let _chart     = null;
let _container = null;
let _showGroups  = false;
let _showNumbers = false;

const TEMPLATE = `
<div class="editor-layout">
  <div class="editor-toolbar">
    <div class="toolbar-left">
      <button class="btn btn-ghost btn-sm" id="btn-editor-back"><i class="fa-solid fa-arrow-left"></i></button>
      <span id="editor-chart-name" class="toolbar-title"></span>
    </div>
    <div class="toolbar-center">
      <button class="btn btn-secondary btn-sm" id="btn-shuffle" title="Randomiser (Ctrl+R)">
        <i class="fa-solid fa-shuffle"></i> Randomiser
      </button>
      <div class="toolbar-divider"></div>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-groups" title="Grupperingsmodus">
        <i class="fa-solid fa-object-group"></i>
      </button>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-numbers" title="Vis pultnumre">
        <i class="fa-solid fa-hashtag"></i>
      </button>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-ghost btn-sm" id="btn-present" title="Åpne presentasjonsvindu">
        <i class="fa-solid fa-tv"></i> Presenter
      </button>
      <button class="btn btn-primary btn-sm" id="btn-save" title="Lagre (Ctrl+S)">
        <i class="fa-solid fa-floppy-disk"></i> Lagre
      </button>
    </div>
  </div>
  <div id="constraint-report" class="constraint-banner hidden">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span id="constraint-report-msg"></span>
    <button class="btn btn-ghost btn-sm" id="btn-close-constraint-report"><i class="fa-solid fa-xmark"></i></button>
  </div>
  <div style="display:flex;flex:1;overflow:hidden">
    <div class="canvas-wrapper" style="flex:1">
      <div id="seating-canvas" class="seating-canvas">
        <div id="front-board" class="front-board board-top">TAVLE</div>
      </div>
    </div>
    <div id="student-sidebar" class="student-sidebar">
      <div class="sidebar-header">
        <span>Elever</span>
        <span id="student-count-badge" class="badge-count">0</span>
      </div>
      <div id="unassigned-students" class="student-list"></div>
    </div>
  </div>
</div>`;

export const seatingEditorView = {
  async mount(container, params = {}) {
    _container = container;
    container.innerHTML = TEMPLATE;
    _showGroups  = false;
    _showNumbers = false;

    if (params.mode === 'new') {
      await initNewChart(params);
    } else if (params.chartId) {
      await loadExistingChart(params.chartId);
    }

    bindEvents();
    bindKeyboardShortcuts();
  },
  unmount() {
    document.removeEventListener('keydown', _keyHandler);
    _chart = null;
    _container = null;
  },
};

/* ---- Initialisering ---- */

async function initNewChart(params) {
  _chart = await buildChartFromParams(params);
  await shuffle(false);
}

async function loadExistingChart(chartId) {
  const raw = await window.api.getSeating(chartId);
  if (!raw) { showToast('Fant ikke klassekart', 'error'); window.navTo('charts-dashboard'); return; }
  _chart = await buildChartFromDb(raw, window.api.getClass);
  render();
}

/* ---- Rendering ---- */

function render() {
  if (!_chart) return;

  const canvas = document.getElementById('seating-canvas');
  if (!canvas) return;

  const displayDesks = getDisplayDesks(_chart.desks, _chart.roomHeight, _chart.flipForDisplay);

  canvas.style.minHeight = (_chart.roomHeight + 40) + 'px';

  const board = document.getElementById('front-board');
  const showAtBottom = _chart.roomDesignMode === 'board-bottom' || _chart.flipForDisplay;
  board?.classList.toggle('board-bottom', showAtBottom);
  board?.classList.toggle('board-top', !showAtBottom);

  renderDesks(canvas, displayDesks, _chart.studentsById, {
    interactive: true,
    showNames: true,
    showNumbers: _showNumbers,
    showGroups: _showGroups,
    onStudentDrop: handleStudentSwap,
    onDeskContextMenu: showDeskContextMenu,
    onStudentContextMenu: showStudentContextMenu,
  });

  renderDecorations(canvas);
  updateChartName();
  renderUnplacedDock();
}

function renderDecorations(canvas) {
  canvas.querySelectorAll('.decoration').forEach(el => el.remove());
  (_chart.decorations ?? []).forEach(deco => {
    const el = document.createElement('div');
    el.className = `decoration decoration-${deco.type}`;
    el.style.cssText = `left:${deco.x}px;top:${deco.y}px;width:${deco.width}px;height:${deco.height}px;pointer-events:none;`;
    if (deco.rotation) el.style.transform = `rotate(${deco.rotation}deg)`;
    if (deco.type === 'label' && deco.label) el.textContent = deco.label;
    canvas.appendChild(el);
  });
}

function updateChartName() {
  const el = document.getElementById('editor-chart-name');
  if (el) el.textContent = _chart.name ?? '';
}

/* ---- Unplaced students dock ---- */

function renderUnplacedDock() {
  const container = document.getElementById('unassigned-students');
  const badge     = document.getElementById('student-count-badge');
  if (!container || !_chart) return;

  // Find which students are placed
  const placedIds = new Set();
  _chart.desks.forEach(desk => {
    (desk.slots ?? []).forEach(slot => { if (slot?.studentId) placedIds.add(slot.studentId); });
  });

  const unplaced = _chart.students.filter(s => !placedIds.has(s.id));
  badge.textContent = unplaced.length;

  container.innerHTML = '';
  unplaced.forEach(student => {
    const chip = document.createElement('div');
    chip.className = 'student-chip';
    chip.textContent = student.name;
    chip.draggable = true;

    chip.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify({ fromSidebar: true, studentId: student.id }));
    });

    container.appendChild(chip);
  });

  // Make sidebar droppable (to return students from desks)
  container.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
  container.addEventListener('drop', e => {
    e.preventDefault();
    const data = safeParseJSON(e.dataTransfer.getData('text/plain'));
    if (!data || data.fromSidebar) return;

    // Remove student from their current slot
    const desk = _chart.desks.find(d => d.id === data.deskId);
    if (desk && desk.slots[data.slotIdx]) {
      desk.slots[data.slotIdx] = null;
      render();
    }
  });
}

/* ---- Shuffle / Randomisering ---- */

async function shuffle(respectLocks = true) {
  if (!_chart) return;

  const [constraints, historyEntries] = await Promise.all([
    window.api.getConstraints(_chart.classId),
    window.api.getHistory(_chart.classId, _chart.avoidLastN),
  ]);

  const historyPairs = historyEntries.flatMap(e => safeParseJSON(e.pairs) ?? []);

  const lockedSlots = {};
  if (respectLocks) {
    _chart.desks.forEach(desk => {
      desk.slots.forEach((slot, i) => {
        if (slot?.locked) {
          if (!lockedSlots[desk.id]) lockedSlots[desk.id] = {};
          lockedSlots[desk.id][i] = slot.studentId;
        }
      });
    });
  }

  const { desks, violations, historyScore } = randomizeSeating(
    _chart.desks, _chart.students, _chart.studentsById,
    { constraints, historyPairs, lockedSlots }
  );

  _chart.desks = desks;
  render();
  showConstraintReport(violations, historyScore);
}

function showConstraintReport(violations, historyScore) {
  const banner = document.getElementById('constraint-report');
  const msg    = document.getElementById('constraint-report-msg');
  if (!banner || !msg) return;

  if (violations.length > 0) {
    msg.textContent = `Obs: ${violations.join('; ')}`;
    banner.classList.remove('hidden');
  } else if (historyScore > 0) {
    msg.textContent = `${historyScore} elevpar sitter sammen som sist.`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ---- Drag-and-drop: student swap between desks ---- */

function handleStudentSwap(fromDeskId, fromSlot, toDeskId, toSlot) {
  // Check if drop came from sidebar
  // (This is called from renderDesks.js which doesn't know about sidebar)
  const fromDesk = _chart.desks.find(d => d.id === fromDeskId);
  const toDesk   = _chart.desks.find(d => d.id === toDeskId);
  if (!fromDesk || !toDesk) return;

  const tmp = fromDesk.slots[fromSlot];
  fromDesk.slots[fromSlot] = toDesk.slots[toSlot];
  toDesk.slots[toSlot] = tmp;

  render();
}

function handleDropFromSidebar(studentId, toDeskId, toSlotIdx) {
  const toDesk = _chart.desks.find(d => d.id === toDeskId);
  if (!toDesk) return;

  // Place student in slot (replacing whoever was there, send them to unplaced)
  toDesk.slots[toSlotIdx] = { studentId, locked: false, note: '' };
  render();
}

/* ---- Context menus ---- */

const COLOR_HEX = { default: '#6b7280', red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', purple: '#8b5cf6', orange: '#f97316', pink: '#ec4899' };

function showDeskContextMenu(deskId, event) {
  const desk = _chart.desks.find(d => d.id === deskId);
  if (!desk) return;

  // Build color swatches as a single item with inline HTML
  const colorSwatches = DESK_COLORS.map(color =>
    `<span class="desk-color-swatch" data-color="${color}" title="${color}" style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${COLOR_HEX[color]};cursor:pointer;border:2px solid ${desk.color===color?'#fff':'transparent'};margin:1px"></span>`
  ).join('');

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.cssText = `left:${event.clientX}px;top:${event.clientY}px`;

  menu.innerHTML = `
    <div class="context-menu-item" id="_cm-clear"><i class="fa-solid fa-eraser"></i> Fjern elever</div>
    <div class="context-menu-divider"></div>
    <div style="padding:6px 12px;font-size:11px;color:oklch(var(--bc)/0.4)">Pultfarge</div>
    <div style="padding:4px 12px 8px;display:flex;flex-wrap:wrap;gap:2px">${colorSwatches}</div>
  `;

  menu.querySelector('#_cm-clear').addEventListener('click', () => {
    desk.slots = desk.slots.map(() => null); render(); menu.remove();
  });
  menu.querySelectorAll('.desk-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      desk.color = swatch.dataset.color; render(); menu.remove();
    });
  });

  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
}

function showStudentContextMenu(deskId, slotIdx, event) {
  const desk = _chart.desks.find(d => d.id === deskId);
  const slot = desk?.slots[slotIdx];
  const student = slot ? _chart.studentsById[slot.studentId] : null;
  if (!student) return;

  showContextMenu(event.clientX, event.clientY, [
    {
      label: slot.locked ? 'Lås opp posisjon' : 'Lås posisjon',
      icon: slot.locked ? 'fa-lock-open' : 'fa-lock',
      action: () => { slot.locked = !slot.locked; render(); }
    },
    { label: 'Rediger notat', icon: 'fa-note-sticky', action: () => openNoteModal(deskId, slotIdx) },
    { divider: true },
    { label: 'Fjern fra pult', icon: 'fa-user-minus', action: () => { desk.slots[slotIdx] = null; render(); }},
  ], 'seating-ctx-menu');
}

/* ---- Notat-modal ---- */

function openNoteModal(deskId, slotIdx) {
  const desk    = _chart.desks.find(d => d.id === deskId);
  const slot    = desk?.slots[slotIdx];
  const student = slot ? _chart.studentsById[slot.studentId] : null;
  if (!student) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-title">Notat — ${escHtml(student.name)}</span>
        <button class="btn btn-ghost btn-sm" id="btn-note-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <textarea id="note-textarea" class="textarea textarea-bordered w-full" style="min-height:120px;resize:vertical">${escHtml(student.note ?? '')}</textarea>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" id="btn-note-cancel">Avbryt</button>
        <button class="btn btn-primary btn-sm" id="btn-note-save">Lagre</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#btn-note-close').addEventListener('click', close);
  backdrop.querySelector('#btn-note-cancel').addEventListener('click', close);
  backdrop.querySelector('#btn-note-save').addEventListener('click', () => {
    student.note = backdrop.querySelector('#note-textarea').value;
    close();
    render();
  });
}

/* ---- Lagre ---- */

async function saveChart() {
  if (!_chart) return;

  const pairs = extractPairsFromLayout(_chart.desks, _chart.studentsById);
  const result = await window.api.saveSeating({
    id: _chart.id,
    name: _chart.name,
    classId: _chart.classId,
    roomId: _chart.roomId,
    placements: JSON.stringify(_chart.desks),
    comment: '',
  });

  const newId = _chart.id ?? result?.lastID;
  _chart.id = newId;

  if (newId && pairs.length) {
    await window.api.saveHistory({ classId: _chart.classId, chartId: newId, pairs });
  }

  showToast('Klassekart lagret!', 'success');
}

/* ---- Presentasjon ---- */

function openPresentation() {
  if (!_chart) return;
  const displayDesks = getDisplayDesks(_chart.desks, _chart.roomHeight, _chart.flipForDisplay);
  window.api.openPresentation(JSON.stringify({
    desks: displayDesks,
    studentsById: _chart.studentsById,
    roomHeight: _chart.roomHeight,
    roomDesignMode: _chart.roomDesignMode,
    flipForDisplay: _chart.flipForDisplay,
    decorations: _chart.decorations,
    chartName: _chart.name,
  }));
}

/* ---- Sidebar drag-to-slot ---- */

function wireDesksForSidebarDrop() {
  const canvas = document.getElementById('seating-canvas');
  if (!canvas) return;

  // Custom event from renderDesks when a sidebar chip is dropped onto a slot
  canvas.addEventListener('sidebar-drop', e => {
    const { studentId, deskId, slotIdx } = e.detail;
    handleDropFromSidebar(studentId, deskId, slotIdx);
  });
}

/* ---- Events ---- */

function bindEvents() {
  document.getElementById('btn-editor-back')?.addEventListener('click', () => window.navTo('charts-dashboard'));
  document.getElementById('btn-save')?.addEventListener('click', saveChart);
  document.getElementById('btn-shuffle')?.addEventListener('click', () => shuffle(true));
  document.getElementById('btn-present')?.addEventListener('click', openPresentation);
  document.getElementById('btn-close-constraint-report')?.addEventListener('click', () => {
    document.getElementById('constraint-report')?.classList.add('hidden');
  });

  document.getElementById('btn-toggle-numbers')?.addEventListener('click', (e) => {
    _showNumbers = !_showNumbers;
    e.currentTarget.classList.toggle('btn-active', _showNumbers);
    render();
  });
  document.getElementById('btn-toggle-groups')?.addEventListener('click', (e) => {
    _showGroups = !_showGroups;
    e.currentTarget.classList.toggle('btn-active', _showGroups);
    render();
  });

  wireDesksForSidebarDrop();

  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());
}

let _keyHandler;
function bindKeyboardShortcuts() {
  _keyHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveChart(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); shuffle(true); }
  };
  document.addEventListener('keydown', _keyHandler);
}

function safeParseJSON(str) {
  if (!str) return null;
  try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return null; }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
