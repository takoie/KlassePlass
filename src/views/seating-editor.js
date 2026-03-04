/**
 * seating-editor.js — Interaktiv klassekarteditor.
 * Modaler, context-menyer og unplaced-dock: seating-editor-modals.js
 */

import { renderDesks }        from '../shared/renderDesks.js';
import { randomizeSeating }   from '../shared/randomize.js';
import { CANVAS_W } from '../shared/constants.js';
import { extractPairsFromLayout, showToast, getPortal } from '../shared/utils.js';
import { buildChartFromParams, buildChartFromDb } from '../shared/chartHelpers.js';
import {
  openNoteModal, openNewPeriodModal,
  showDeskContextMenu, showStudentContextMenu,
  wireDesksForSidebarDrop, renderUnplacedDock,
} from './seating-editor-modals.js';

let _chart     = null;
let _container = null;
let _showGroups  = false;
let _showNumbers = false;

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
  const settings = await window.api.getSettings();
  _chart = await buildChartFromDb(raw, window.api.getClass);
  _chart.flipForDisplay = settings.defaultFlipDisplay ?? false;
  render();
}

/* ---- Rendering ---- */

function render() {
  if (!_chart) return;

  const canvas = document.getElementById('seating-canvas');
  if (!canvas) return;

  canvas.style.minHeight = (_chart.roomHeight + 40) + 'px';
  canvas.classList.toggle('canvas-rotated', !!_chart.flipForDisplay);

  const board = document.getElementById('front-board');
  const boardDataAtBottom    = _chart.roomDesignMode === 'board-bottom';
  const boardVisuallyAtBottom = boardDataAtBottom !== !!_chart.flipForDisplay;
  board?.classList.toggle('board-bottom', boardVisuallyAtBottom);
  board?.classList.toggle('board-top', !boardVisuallyAtBottom);

  renderDesks(canvas, _chart.desks, _chart.studentsById, {
    interactive: true,
    showNames: true,
    showNumbers: _showNumbers,
    showGroups: _showGroups,
    onStudentDrop: handleStudentSwap,
    onDeskContextMenu: (deskId, event) => showDeskContextMenu(deskId, event, _chart, render),
    onStudentContextMenu: (deskId, slotIdx, event) => showStudentContextMenu(deskId, slotIdx, event, _chart, render),
  });

  renderDecorations(canvas);
  updateChartName();
  renderUnplacedDock(_chart, render);
}

function renderDecorations(canvas) {
  canvas.querySelectorAll('.decoration').forEach(el => el.remove());
  (_chart.decorations ?? []).forEach(deco => {
    const el = document.createElement('div');
    el.className = `decoration decoration-${deco.type}`;

    let x = deco.x, y = deco.y;
    let rot = deco.rotation ?? 0;

    if (_chart.flipForDisplay) {
      x = CANVAS_W - deco.x - deco.width;
      y = _chart.roomHeight - deco.y - deco.height;
      rot = (rot + 180) % 360;
    }

    el.style.cssText = `left:${x}px;top:${y}px;width:${deco.width}px;height:${deco.height}px;pointer-events:none;`;
    el.style.transform = `rotate(${rot}deg)`;
    if (deco.type === 'label' && deco.label) el.textContent = deco.label;
    canvas.appendChild(el);
  });
}

function updateChartName() {
  const el = document.getElementById('editor-chart-name');
  if (el) el.textContent = _chart.name ?? '';
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
  toDesk.slots[toSlotIdx] = { studentId, locked: false, note: '' };
  render();
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
    comment: _chart.comment ?? '',
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
  window.api.openPresentation(JSON.stringify({
    desks: _chart.desks,
    studentsById: _chart.studentsById,
    roomHeight: _chart.roomHeight,
    roomDesignMode: _chart.roomDesignMode,
    flipForDisplay: _chart.flipForDisplay,
    decorations: _chart.decorations,
    chartName: _chart.name,
  }));
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

  const flipBtn = document.getElementById('btn-flip-view');
  flipBtn?.addEventListener('click', (e) => {
    if (_chart) {
      _chart.flipForDisplay = !_chart.flipForDisplay;
      e.currentTarget.classList.toggle('btn-active', _chart.flipForDisplay);
      render();
    }
  });
  if (_chart?.flipForDisplay) flipBtn?.classList.add('btn-active');

  document.getElementById('btn-new-period')?.addEventListener('click', () =>
    openNewPeriodModal(_chart, window.navTo));

  wireDesksForSidebarDrop(_chart, handleDropFromSidebar);

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

/* ---- Template ---- */

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
      <button class="btn btn-ghost btn-sm" id="btn-toggle-numbers" title="Vis bordnumre">
        <i class="fa-solid fa-hashtag"></i>
      </button>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-ghost btn-sm" id="btn-flip-view" title="Roter visning 180°">
        <i class="fa-solid fa-rotate-180"></i> Roter visning
      </button>
      <div class="toolbar-divider"></div>
      <button class="btn btn-ghost btn-sm" id="btn-new-period" title="Start ny periode">
        <i class="fa-solid fa-calendar-plus"></i> Ny periode
      </button>
      <div class="toolbar-divider"></div>
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
