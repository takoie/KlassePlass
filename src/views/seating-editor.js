/**
 * seating-editor.js — Interaktiv klassekarteditor.
 * Modaler, context-menyer og unplaced-dock: seating-editor-modals.js
 */

import { renderDesks }        from '../shared/renderDesks.js';
import { randomizeSeating }   from '../shared/randomize.js';
import { checkHardConstraints, getViolatingDeskIds } from '../shared/constraints.js';
import { CANVAS_W } from '../shared/constants.js';
import { buildDecoSVG } from '../shared/decoSvg.js';
import { extractPairsFromLayout, extractNeighborsFromLayout, showToast, getPortal } from '../shared/utils.js';
import { buildChartFromParams, buildChartFromDb } from '../shared/chartHelpers.js';
import {
  openNoteModal, openNewPeriodModal,
  showDeskContextMenu, showStudentContextMenu,
  wireDesksForSidebarDrop, renderUnplacedDock,
  showConstraintConfirm,
  showSpinPlacementModal, showSpinStudentModal,
  showManageRulesModal,
} from './seating-editor-modals.js';

let _chart            = null;
let _container        = null;
let _showGroups       = false;
let _showNumbers      = false;
let _showHistory      = false;
let _displayMode      = 'teacher'; // 'teacher' | 'discussion' | 'student-build' | 'display' | 'participation'
let _participationData = {}; // { [studentId]: string[] } — events per student today
let _participationDate = '';

const DISPLAY_MODES = {
  teacher:       { label: 'Lærer',          icon: 'fa-chalkboard-user',  hideNames: false, hideLocks: false, hideNotes: false, hideGroups: false },
  discussion:    { label: 'Diskusjon',       icon: 'fa-comments',         hideNames: false, hideLocks: false, hideNotes: true,  hideGroups: false },
  'student-build': { label: 'Elev-bygging', icon: 'fa-users',            hideNames: true,  hideLocks: true,  hideNotes: true,  hideGroups: true  },
  display:       { label: 'Visning',         icon: 'fa-eye',              hideNames: false, hideLocks: true,  hideNotes: true,  hideGroups: true  },
  participation: { label: 'Deltakelse',      icon: 'fa-clipboard-check',  hideNames: false, hideLocks: true,  hideNotes: true,  hideGroups: true  },
};

export const seatingEditorView = {
  async mount(container, params = {}) {
    _container = container;
    container.innerHTML = TEMPLATE;
    _showGroups        = false;
    _showNumbers       = false;
    _showHistory       = false;
    _displayMode       = 'teacher';
    _participationData = {};
    _participationDate = new Date().toISOString().split('T')[0];

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
  _chart.constraints = await window.api.getConstraints(_chart.classId);
  await shuffle(false);
}

async function loadExistingChart(chartId) {
  const raw = await window.api.getSeating(chartId);
  if (!raw) { showToast('Fant ikke klassekart', 'error'); window.navTo('charts-dashboard'); return; }
  const settings = await window.api.getSettings();
  _chart = await buildChartFromDb(raw, window.api.getClass);
  _chart.constraints = await window.api.getConstraints(_chart.classId);
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

  const fb = document.getElementById('front-board');
  if (fb) {
    const isBottom = (_chart.roomDesignMode === 'board-bottom') !== !!_chart.flipForDisplay;
    fb.classList.toggle('board-top', !isBottom);
    fb.classList.toggle('board-bottom', isBottom);
  }

  const modeOpts = DISPLAY_MODES[_displayMode] ?? DISPLAY_MODES.teacher;
  renderDesks(canvas, _chart.desks, _chart.studentsById, {
    interactive: _displayMode !== 'display',
    showNames: !modeOpts.hideNames,
    showNumbers: _showNumbers,
    showGroups: _showGroups && !modeOpts.hideGroups,
    hideIcons: modeOpts.hideLocks && modeOpts.hideNotes,
    hideLocks: modeOpts.hideLocks,
    hideNotes: modeOpts.hideNotes,
    onStudentDrop: handleStudentSwap,
    onDeskContextMenu: (deskId, event) => showDeskContextMenu(deskId, event, _chart, render),
    onStudentContextMenu: (deskId, slotIdx, event) => showStudentContextMenu(deskId, slotIdx, event, _chart, render, _chart.constraints),
  });
  updateGroupLegend();

  renderDecorations(canvas);
  updateChartName();
  renderUnplacedDock(_chart, render);
  markViolations();
  if (_displayMode === 'participation') renderParticipationBadges();
}

function markViolations() {
  if (!_chart?.constraints?.length) {
    document.querySelectorAll('.desk-violation').forEach(el => el.classList.remove('desk-violation'));
    return;
  }
  const ids = getViolatingDeskIds(_chart.desks, _chart.studentsById, _chart.constraints);
  document.querySelectorAll('.desk').forEach(el => {
    const id = el.dataset.deskId;
    el.classList.toggle('desk-violation', ids.has(id));
  });
}

function updateGroupLegend() {
  const legend = document.getElementById('group-legend');
  if (!legend) return;
  if (!_showGroups || !_chart) { legend.classList.add('hidden'); return; }

  const usedGroups = new Set(_chart.desks.map(d => d.groupId).filter(g => g != null));
  if (usedGroups.size === 0) { legend.classList.add('hidden'); return; }

  const GROUP_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];
  legend.innerHTML = [...usedGroups].sort((a,b) => a-b).map(g => {
    const color = GROUP_COLORS[g % 8];
    return `<span class="group-legend-item" style="border-color:${color};background:${color}22">Gruppe ${g + 1}</span>`;
  }).join('');
  legend.classList.remove('hidden');
}

async function renderHistoryPanel() {
  const panel = document.getElementById('history-panel-content');
  if (!panel || !_chart) return;

  panel.innerHTML = '<div style="padding:8px;font-size:12px;opacity:0.5">Laster historikk…</div>';
  const entries = await window.api.getHistory(_chart.classId, 10);

  if (!entries.length) {
    panel.innerHTML = '<div style="padding:8px;font-size:12px;opacity:0.5">Ingen historikk ennå.</div>';
    return;
  }

  panel.innerHTML = entries.map(e => {
    const pairs = safeParseJSON(e.pairs) ?? [];
    const date  = new Date(e.created_at).toLocaleDateString('no-NO', { day:'2-digit', month:'short' });
    const pairsHtml = pairs.slice(0, 6).map(([a, b]) =>
      `<span class="history-pair">${_escHtmlSafe(a)} + ${_escHtmlSafe(b)}</span>`
    ).join('');
    const more = pairs.length > 6 ? `<span style="opacity:0.5;font-size:10px">+${pairs.length - 6} til</span>` : '';
    return `
      <div class="history-entry">
        <div class="history-entry-date">${date}</div>
        <div class="history-entry-pairs">${pairsHtml}${more}</div>
      </div>`;
  }).join('');
}

function _escHtmlSafe(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Decorations that should never be rotated 180° when the view is flipped — they have a
// clear "upright" orientation and flipping makes them look wrong (trashcan upside-down etc.)
const UPRIGHT_ONLY_DECOS = new Set(['trashcan', 'sink', 'screen', 'whiteboard', 'bookshelf']);

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
      if (!UPRIGHT_ONLY_DECOS.has(deco.type)) {
        rot = (rot + 180) % 360;
      }
    }

    el.style.cssText = `left:${x}px;top:${y}px;width:${deco.width}px;height:${deco.height}px;pointer-events:none;`;
    el.style.transform = `rotate(${rot}deg)`;
    if (deco.type === 'label') {
      el.textContent = deco.label ?? '';
    } else {
      const svg = buildDecoSVG(deco.type);
      if (svg) el.innerHTML = svg;
    }
    if (deco.type === 'whiteboard') {
      const label = el.querySelector('.deco-whiteboard-label');
      if (label) label.style.transform = `rotate(${-rot}deg)`;
    }
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

  const [freshConstraints, historyEntries] = await Promise.all([
    window.api.getConstraints(_chart.classId),
    window.api.getHistory(_chart.classId, _chart.avoidLastN),
  ]);
  _chart.constraints = freshConstraints;
  const constraints = freshConstraints;

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
  setSaveStatus('unsaved');
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

async function handleStudentSwap(fromDeskId, fromSlot, toDeskId, toSlot) {
  const fromDesk = _chart.desks.find(d => d.id === fromDeskId);
  const toDesk   = _chart.desks.find(d => d.id === toDeskId);
  if (!fromDesk || !toDesk) return;

  const tentative = structuredClone(_chart.desks);
  const tFrom = tentative.find(d => d.id === fromDeskId);
  const tTo   = tentative.find(d => d.id === toDeskId);
  const tmp = tFrom.slots[fromSlot];
  tFrom.slots[fromSlot] = tTo.slots[toSlot];
  tTo.slots[toSlot] = tmp;

  const { valid, violations } = checkHardConstraints(tentative, _chart.studentsById, _chart.constraints ?? []);
  if (!valid) {
    const confirmed = await showConstraintConfirm(violations);
    if (!confirmed) return;
  }

  const tmp2 = fromDesk.slots[fromSlot];
  fromDesk.slots[fromSlot] = toDesk.slots[toSlot];
  toDesk.slots[toSlot] = tmp2;
  setSaveStatus('unsaved');
  render();
}

async function handleDropFromSidebar(studentId, toDeskId, toSlotIdx) {
  const toDesk = _chart.desks.find(d => d.id === toDeskId);
  if (!toDesk) return;

  const tentative = structuredClone(_chart.desks);
  const tDesk = tentative.find(d => d.id === toDeskId);
  tDesk.slots[toSlotIdx] = { studentId, locked: false, note: '' };

  const { valid, violations } = checkHardConstraints(tentative, _chart.studentsById, _chart.constraints ?? []);
  if (!valid) {
    const confirmed = await showConstraintConfirm(violations);
    if (!confirmed) return;
  }

  toDesk.slots[toSlotIdx] = { studentId, locked: false, note: '' };
  setSaveStatus('unsaved');
  render();
}

/* ---- Lagreindikator ---- */

function setSaveStatus(state) {
  const el = document.getElementById('editor-save-status');
  if (!el) return;
  if (state === 'saved') {
    el.textContent = 'Lagret';
    el.className = 'save-status saved';
  } else if (state === 'unsaved') {
    el.textContent = 'Ulagrede endringer';
    el.className = 'save-status unsaved';
  } else {
    el.textContent = 'Lagrer…';
    el.className = 'save-status saving';
  }
}

/* ---- Lagre ---- */

async function saveChart() {
  if (!_chart) return;
  const btn = document.getElementById('btn-save');
  if (btn) btn.disabled = true;
  setSaveStatus('saving');
  try {
    const pairs     = extractPairsFromLayout(_chart.desks, _chart.studentsById);
    const neighbors = extractNeighborsFromLayout(_chart.desks, _chart.studentsById);
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

    if (newId && neighbors.length) {
      await window.api.saveHistory({ classId: _chart.classId, chartId: newId, pairs, neighbors });
    } else if (newId && pairs.length) {
      await window.api.saveHistory({ classId: _chart.classId, chartId: newId, pairs, neighbors: [] });
    }

    setSaveStatus('saved');
    showToast('Klassekart lagret!', 'success');
  } catch (err) {
    setSaveStatus('');
    showToast('Feil ved lagring. Prøv igjen.', 'error');
    console.error('saveChart error:', err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---- Presentasjon ---- */

function openPresentation() {
  if (!_chart) return;
  window.api.openPresentation(JSON.stringify({
    desks:          _chart.desks,
    studentsById:   _chart.studentsById,
    roomHeight:     _chart.roomHeight,
    roomDesignMode: _chart.roomDesignMode,
    flipForDisplay: _chart.flipForDisplay,
    decorations:    _chart.decorations,
    chartName:      _chart.name,
    theme:          document.documentElement.dataset.theme ?? 'night',
    canvasBg:       document.documentElement.dataset.canvasBg ?? 'solid',
  }));
}

/* ---- Events ---- */

function bindEvents() {
  document.getElementById('btn-editor-back')?.addEventListener('click', () => window.navTo('charts-dashboard'));
  document.getElementById('btn-save')?.addEventListener('click', saveChart);
  document.getElementById('btn-shuffle')?.addEventListener('click', () => shuffle(true));
  document.getElementById('btn-print')?.addEventListener('click', () => {
    if (_chart) window.openPrintOverlay(_chart);
  });
  document.getElementById('btn-participation-summary')?.addEventListener('click', () => {
    if (_chart) showParticipationSummary();
  });
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

  document.getElementById('btn-toggle-history')?.addEventListener('click', (e) => {
    _showHistory = !_showHistory;
    e.currentTarget.classList.toggle('btn-active', _showHistory);
    const panel = document.getElementById('history-sidebar');
    panel?.classList.toggle('hidden', !_showHistory);
    if (_showHistory) renderHistoryPanel();
  });

  // Display mode dropdown
  const dmBtn = document.getElementById('btn-display-mode');
  const dmDropdown = document.getElementById('display-mode-dropdown');
  dmBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dmDropdown?.classList.toggle('hidden');
  });
  dmDropdown?.querySelectorAll('[data-mode]').forEach(item => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      _displayMode = item.dataset.mode;
      dmDropdown.classList.add('hidden');
      const modeLabel = DISPLAY_MODES[_displayMode]?.label ?? 'Lærer';
      if (dmBtn) dmBtn.querySelector('.mode-label').textContent = modeLabel;
      if (_displayMode === 'participation') await loadParticipation();
      render();
      // Vis/skjul oppsummerings-knapp
      const summaryBtn = document.getElementById('btn-participation-summary');
      summaryBtn?.classList.toggle('hidden', _displayMode !== 'participation');
    });
  });
  document.addEventListener('click', () => dmDropdown?.classList.add('hidden'));

  // Fun modes dropdown
  const funBtn = document.getElementById('btn-fun-mode');
  const funDropdown = document.getElementById('fun-mode-dropdown');
  funBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    funDropdown?.classList.toggle('hidden');
  });
  document.getElementById('btn-spin-placement')?.addEventListener('click', (e) => {
    e.stopPropagation();
    funDropdown?.classList.add('hidden');
    showSpinPlacementModal(_chart, render);
  });
  document.getElementById('btn-spin-student')?.addEventListener('click', (e) => {
    e.stopPropagation();
    funDropdown?.classList.add('hidden');
    showSpinStudentModal(_chart);
  });
  document.addEventListener('click', () => funDropdown?.classList.add('hidden'));

  // Sidebar collapse
  const sidebar = document.getElementById('student-sidebar');
  document.getElementById('btn-collapse-sidebar')?.addEventListener('click', () => {
    const collapsed = sidebar?.classList.toggle('sidebar-collapsed');
    const icon = document.querySelector('#btn-collapse-sidebar i');
    if (icon) icon.className = collapsed ? 'fa-solid fa-chevron-left' : 'fa-solid fa-chevron-right';
  });

  // Place all unassigned students
  document.getElementById('btn-place-all')?.addEventListener('click', () => {
    if (!_chart) return;
    const unplaced = Object.values(_chart.studentsById).filter(s => {
      return !_chart.desks.some(d => d.slots.some(sl => sl?.studentId === s.id));
    });
    if (!unplaced.length) { showToast('Ingen elever å plassere', 'info'); return; }
    const emptySlots = [];
    _chart.desks.forEach(desk => {
      desk.slots.forEach((sl, i) => { if (!sl?.studentId) emptySlots.push({ desk, idx: i }); });
    });
    // Fisher-Yates shuffle of empty slots
    for (let i = emptySlots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptySlots[i], emptySlots[j]] = [emptySlots[j], emptySlots[i]];
    }
    unplaced.forEach((student, i) => {
      if (i < emptySlots.length) {
        const { desk, idx } = emptySlots[i];
        desk.slots[idx] = { studentId: student.id, locked: false, note: '' };
      }
    });
    render();
  });

  // Unplace all students
  document.getElementById('btn-unplace-all')?.addEventListener('click', () => {
    if (!_chart) return;
    _chart.desks.forEach(desk => { desk.slots = desk.slots.map(() => null); });
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

  // Klikk på pult i deltakelsesmodus
  document.getElementById('seating-canvas')?.addEventListener('click', (e) => {
    if (_displayMode !== 'participation') return;
    const deskEl = e.target.closest('[data-desk-id]');
    if (!deskEl) return;
    const deskId = deskEl.dataset.deskId;
    const desk = _chart?.desks.find(d => d.id === deskId);
    if (!desk) return;
    const slot = desk.slots?.[0];
    if (!slot?.studentId) return;
    const studentData = _chart.studentsById?.[slot.studentId];
    if (!studentData) return;
    showParticipationMenu(e.clientX, e.clientY, slot.studentId, studentData.name);
  });
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

/* ---- Deltakelseslogg ---- */

const PARTICIPATION_EVENTS = [
  { type: 'lekse',       label: '✓ Hadde lekse',    color: '#22c55e' },
  { type: 'ingen-lekse', label: '✗ Manglet lekse',  color: '#ef4444' },
  { type: 'svarte',      label: '✋ Svarte',         color: '#3b82f6' },
  { type: 'notert',      label: '📝 Notert',         color: '#f59e0b' },
];

async function loadParticipation() {
  if (!_chart?.id) return;
  const rows = await window.api.getParticipation(_chart.id, _participationDate);
  _participationData = {};
  for (const row of rows) {
    _participationData[row.student_id] = safeParseJSON(row.events) ?? [];
  }
}

async function logParticipationEvent(studentId, eventType) {
  if (!_chart?.id || !studentId) return;
  const events = [...(_participationData[studentId] ?? []), eventType];
  _participationData[studentId] = events;
  await window.api.saveParticipation({
    seatingId: _chart.id,
    studentId,
    date: _participationDate,
    events,
  });
  renderParticipationBadges();
}

function renderParticipationBadges() {
  document.querySelectorAll('.participation-badge').forEach(el => el.remove());
  if (_displayMode !== 'participation') return;

  const canvas = document.getElementById('seating-canvas');
  if (!canvas) return;

  for (const desk of _chart?.desks ?? []) {
    const slot = desk.slots?.[0];
    if (!slot?.studentId) continue;
    const events = _participationData[slot.studentId] ?? [];
    if (!events.length) continue;

    const deskEl = canvas.querySelector(`[data-desk-id="${desk.id}"]`);
    if (!deskEl) continue;

    const badge = document.createElement('div');
    badge.className = 'participation-badge';
    for (const ev of events) {
      const dot = document.createElement('span');
      dot.className = `part-dot part-dot-${ev}`;
      dot.title = PARTICIPATION_EVENTS.find(e => e.type === ev)?.label ?? ev;
      badge.appendChild(dot);
    }
    deskEl.style.position = 'absolute';
    deskEl.appendChild(badge);
  }
}

function showParticipationMenu(clientX, clientY, studentId, studentName) {
  document.querySelectorAll('.participation-menu').forEach(el => el.remove());

  const menu = document.createElement('div');
  menu.className = 'context-menu participation-menu';
  menu.style.cssText = `position:fixed;left:${clientX}px;top:${clientY}px;z-index:9000;`;
  menu.innerHTML = `
    <div style="padding:6px 10px;font-size:11px;opacity:0.5;font-weight:600;border-bottom:1px solid oklch(var(--b3)/0.5)">
      ${_escHtmlSafe(studentName)}
    </div>
    ${PARTICIPATION_EVENTS.map(ev => `
      <div class="context-menu-item" data-event="${ev.type}" style="gap:8px">
        <span>${ev.label}</span>
      </div>`).join('')}
    <div style="border-top:1px solid oklch(var(--b3)/0.5);margin-top:2px"></div>
    <div class="context-menu-item" data-event="clear" style="font-size:11px;opacity:0.6">
      <i class="fa fa-trash"></i> Nullstill
    </div>`;

  document.body.appendChild(menu);

  // Sørg for at menyen er innenfor vinduet
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (clientX - rect.width) + 'px';
  if (rect.bottom > window.innerHeight) menu.style.top = (clientY - rect.height) + 'px';

  menu.querySelectorAll('[data-event]').forEach(item => {
    item.addEventListener('click', async () => {
      const eventType = item.dataset.event;
      if (eventType === 'clear') {
        _participationData[studentId] = [];
        if (_chart?.id) {
          await window.api.saveParticipation({
            seatingId: _chart.id, studentId, date: _participationDate, events: [],
          });
        }
        renderParticipationBadges();
      } else {
        await logParticipationEvent(studentId, eventType);
      }
      menu.remove();
    });
  });

  const closeMenu = (e) => {
    if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

async function showParticipationSummary() {
  const portal = getPortal();
  const rows = await window.api.getParticipationSummary(_chart.id);

  const studentNames = {};
  for (const s of (_chart.students ?? [])) studentNames[s.id] = s.name;

  // Aggreger per elev
  const byStudent = {};
  for (const row of rows) {
    const events = safeParseJSON(row.events) ?? [];
    if (!byStudent[row.student_id]) byStudent[row.student_id] = {};
    for (const ev of events) {
      byStudent[row.student_id][ev] = (byStudent[row.student_id][ev] ?? 0) + 1;
    }
  }

  const tableRows = Object.entries(byStudent).map(([sid, counts]) => {
    const name = studentNames[sid] ?? sid;
    const cells = PARTICIPATION_EVENTS.map(ev =>
      `<td class="text-center">${counts[ev.type] ?? '—'}</td>`
    ).join('');
    return `<tr><td>${_escHtmlSafe(name)}</td>${cells}</tr>`;
  });

  if (tableRows.length === 0) {
    tableRows.push('<tr><td colspan="5" class="text-center opacity-50 py-4">Ingen data ennå.</td></tr>');
  }

  const html = `
    <div class="modal modal-open" id="participation-summary-modal" style="z-index:9000">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-1">
          <i class="fa-solid fa-clipboard-check mr-2 text-primary"></i>Deltakelsesoppsummering
        </h3>
        <p class="text-sm opacity-60 mb-4">Alle registrerte hendelser for ${_chart.name ?? 'dette klassekartet'}.</p>
        <div class="overflow-x-auto">
          <table class="table table-sm w-full">
            <thead>
              <tr>
                <th>Elev</th>
                ${PARTICIPATION_EVENTS.map(ev => `<th class="text-center">${ev.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>${tableRows.join('')}</tbody>
          </table>
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('participation-summary-modal')?.remove()">Lukk</button>
        </div>
      </div>
      <div class="modal-backdrop" onclick="document.getElementById('participation-summary-modal')?.remove()"></div>
    </div>`;
  portal.insertAdjacentHTML('beforeend', html);
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
        <i class="fa-solid fa-shuffle"></i> <span class="toolbar-btn-label">Randomiser</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-groups" title="Vis grupper">
        <i class="fa-solid fa-object-group"></i> <span class="toolbar-btn-label">Grupper</span>
      </button>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-numbers" title="Vis bordnumre">
        <i class="fa-solid fa-hashtag"></i>
      </button>
      <button class="btn btn-ghost btn-sm" id="btn-toggle-history" title="Vis elevhistorikk">
        <i class="fa-solid fa-clock-rotate-left"></i>
      </button>
      <div class="toolbar-divider"></div>
      <div class="toolbar-dropdown-wrap" style="position:relative">
        <button class="btn btn-ghost btn-sm" id="btn-display-mode" title="Visningsmodus">
          <i class="fa-solid fa-eye"></i> <span class="mode-label toolbar-btn-label">Lærer</span> <i class="fa-solid fa-chevron-down" style="font-size:9px;opacity:0.6"></i>
        </button>
        <div id="display-mode-dropdown" class="toolbar-dropdown hidden">
          <div class="toolbar-dropdown-item" data-mode="teacher"><i class="fa-solid fa-chalkboard-user"></i> Lærer</div>
          <div class="toolbar-dropdown-item" data-mode="discussion"><i class="fa-solid fa-comments"></i> Diskusjon</div>
          <div class="toolbar-dropdown-item" data-mode="student-build"><i class="fa-solid fa-users"></i> Elev-bygging</div>
          <div class="toolbar-dropdown-item" data-mode="display"><i class="fa-solid fa-eye"></i> Visning</div>
          <div class="toolbar-dropdown-item" data-mode="participation"><i class="fa-solid fa-clipboard-check"></i> Deltakelse</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm hidden" id="btn-participation-summary" title="Vis deltakelsesoppsummering">
        <i class="fa-solid fa-chart-bar"></i>
      </button>
      <div class="toolbar-dropdown-wrap" style="position:relative">
        <button class="btn btn-ghost btn-sm" id="btn-fun-mode" title="Morsomme moduser">
          <i class="fa-solid fa-dice"></i> <i class="fa-solid fa-chevron-down" style="font-size:9px;opacity:0.6"></i>
        </button>
        <div id="fun-mode-dropdown" class="toolbar-dropdown hidden">
          <div class="toolbar-dropdown-item" id="btn-spin-placement"><i class="fa-solid fa-chair"></i> Plasserings-spin</div>
          <div class="toolbar-dropdown-item" id="btn-spin-student"><i class="fa-solid fa-person-rays"></i> Trekk elev</div>
        </div>
      </div>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-ghost btn-sm" id="btn-flip-view" title="Roter visning 180°">
        <i class="fa-solid fa-rotate-180"></i> <span class="toolbar-btn-label">Roter</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="btn btn-ghost btn-sm" id="btn-new-period" title="Start ny periode">
        <i class="fa-solid fa-calendar-plus"></i> <span class="toolbar-btn-label">Ny periode</span>
      </button>
      <div class="toolbar-divider"></div>
      <button class="btn btn-ghost btn-sm" id="btn-print" title="Skriv ut / Vikarmodus">
        <i class="fa-solid fa-print"></i> <span class="toolbar-btn-label">Skriv ut</span>
      </button>
      <button class="btn btn-ghost btn-sm" id="btn-present" title="Åpne presentasjonsvindu">
        <i class="fa-solid fa-tv"></i> <span class="toolbar-btn-label">Presenter</span>
      </button>
      <span id="editor-save-status" class="save-status"></span>
      <button class="btn btn-primary btn-sm" id="btn-save" title="Lagre (Ctrl+S)">
        <i class="fa-solid fa-floppy-disk"></i> <span class="toolbar-btn-label">Lagre</span>
      </button>
    </div>
  </div>
  <div id="constraint-report" class="constraint-banner hidden">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span id="constraint-report-msg"></span>
    <button class="btn btn-ghost btn-sm" id="btn-close-constraint-report"><i class="fa-solid fa-xmark"></i></button>
  </div>
  <div id="group-legend" class="group-legend hidden"></div>
  <div style="display:flex;flex:1;overflow:hidden">
    <div class="canvas-wrapper" style="flex:1;overflow:auto">
      <div id="seating-canvas" class="seating-canvas">
      </div>
    </div>
    <div id="student-sidebar" class="student-sidebar sidebar-collapsed">
      <div class="sidebar-header">
        <span class="sidebar-header-label">Elever</span>
        <span id="student-count-badge" class="badge-count">0</span>
        <button class="btn btn-ghost btn-xs sidebar-action-btn" id="btn-place-all" title="Plasser alle resterende elever tilfeldig">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
        </button>
        <button class="btn btn-ghost btn-xs sidebar-action-btn" id="btn-unplace-all" title="Flytt alle elever tilbake hit">
          <i class="fa-solid fa-right-to-bracket"></i>
        </button>
        <button class="btn btn-ghost btn-xs sidebar-action-btn" id="btn-collapse-sidebar" title="Kollaps elevliste">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
      </div>
      <div id="unassigned-students" class="student-list"></div>
    </div>
    <div id="history-sidebar" class="history-sidebar hidden">
      <div class="sidebar-header">
        <span>Historikk</span>
        <i class="fa-solid fa-clock-rotate-left" style="opacity:0.4;font-size:12px"></i>
      </div>
      <div id="history-panel-content" class="student-list"></div>
    </div>
  </div>
</div>`;
