/**
 * seating-editor-modals.js — Modaler, context-menyer og unplaced-dock
 * for seating-editoren.
 * Eksporterer: openNoteModal, openNewPeriodModal, showDeskContextMenu,
 *              showStudentContextMenu, wireDesksForSidebarDrop, renderUnplacedDock,
 *              showConstraintConfirm, showManageRulesModal,
 *              showSpinPlacementModal, showSpinStudentModal
 */

import { DESK_COLORS } from '../shared/constants.js';
import { showToast, showConfirm, getWeekNumber, getPortal } from '../shared/utils.js';
import { showContextMenu } from '../shared/contextMenu.js';

const COLOR_HEX = {
  default: '#6b7280', red: '#ef4444', green: '#22c55e', blue: '#3b82f6',
  yellow: '#eab308', purple: '#8b5cf6', orange: '#f97316', pink: '#ec4899',
};

/* ---- Unplaced students dock ---- */

// Stable references shared between renderUnplacedDock calls so listeners are
// registered only once per container DOM element (avoids duplicate-listener leak).
let _dockListenerEl = null;
let _dockChartRef = null;
let _dockRenderFnRef = null;

export function renderUnplacedDock(chart, renderFn) {
  const container = document.getElementById('unassigned-students');
  const badge     = document.getElementById('student-count-badge');
  if (!container || !chart) return;

  _dockChartRef = chart;
  _dockRenderFnRef = renderFn;

  const placedIds = new Set();
  chart.desks.forEach(desk => {
    (desk.slots ?? []).forEach(slot => { if (slot?.studentId) placedIds.add(slot.studentId); });
  });

  const unplaced = chart.students.filter(s => !placedIds.has(s.id));
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

  // Only attach container-level listeners once per DOM element instance
  if (_dockListenerEl !== container) {
    _dockListenerEl = container;
    container.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    container.addEventListener('drop', e => {
      e.preventDefault();
      const data = _safeParseJSON(e.dataTransfer.getData('text/plain'));
      if (!data || data.fromSidebar || !_dockChartRef) return;
      const desk = _dockChartRef.desks.find(d => d.id === data.deskId);
      if (desk && desk.slots[data.slotIdx]) { desk.slots[data.slotIdx] = null; _dockRenderFnRef?.(); }
    });
  }
}

/* ---- Sidebar drag-to-slot wiring ---- */

export function wireDesksForSidebarDrop(chart, handleDropFromSidebar) {
  const canvas = document.getElementById('seating-canvas');
  if (!canvas) return;
  canvas.addEventListener('sidebar-drop', e => {
    const { studentId, deskId, slotIdx } = e.detail;
    handleDropFromSidebar(studentId, deskId, slotIdx);
  });
}

/* ---- Context menus ---- */

const GROUP_COLORS_HEX = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

export function showDeskContextMenu(deskId, event, chart, renderFn) {
  const desk = chart.desks.find(d => d.id === deskId);
  if (!desk) return;

  // Remove any existing desk context menu
  document.getElementById('_desk-ctx-menu')?.remove();

  const swatchBorder = (active) => active ? '2px solid oklch(var(--bc))' : '2px solid transparent';

  const colorSwatches = DESK_COLORS.map(color =>
    `<span class="desk-color-swatch" data-color="${color}" title="${color}" style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${COLOR_HEX[color]};cursor:pointer;border:${swatchBorder(desk.color===color)};margin:1px"></span>`
  ).join('');

  const groupSwatches = [
    `<span class="desk-group-swatch" data-group="" title="Ingen gruppe" style="display:inline-block;width:18px;height:18px;border-radius:4px;background:oklch(var(--b3));cursor:pointer;border:${swatchBorder(desk.groupId==null)};margin:1px;font-size:8px;line-height:18px;text-align:center;color:oklch(var(--bc))">–</span>`,
    ...GROUP_COLORS_HEX.map((c, i) =>
      `<span class="desk-group-swatch" data-group="${i}" title="Gruppe ${i+1}" style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${c};cursor:pointer;border:${swatchBorder(desk.groupId===i)};margin:1px;font-size:8px;line-height:18px;text-align:center;color:oklch(var(--pc))">${i+1}</span>`
    )
  ].join('');

  // Build per-slot student rows for slots that have a student
  const studentRows = desk.slots.map((slot, slotIdx) => {
    const student = slot?.studentId ? chart.studentsById[slot.studentId] : null;
    if (!student) return '';
    const lockIcon = slot.locked ? 'fa-lock' : 'fa-lock-open';
    const lockTitle = slot.locked ? 'Lås opp' : 'Lås';
    const hasConstraints = (chart.constraints ?? []).some(
      c => c.student_a === student.name || c.student_b === student.name
    );
    return `
      <div class="desk-ctx-student-row" data-slot="${slotIdx}">
        <span class="desk-ctx-student-name" title="${_escHtml(student.name)}">${_escHtml(student.name)}</span>
        <div class="desk-ctx-student-actions">
          <button class="btn btn-ghost btn-xs desk-ctx-lock" data-slot="${slotIdx}" title="${lockTitle}">
            <i class="fa-solid ${lockIcon}"></i>
          </button>
          <button class="btn btn-ghost btn-xs desk-ctx-note" data-slot="${slotIdx}" title="Notat">
            <i class="fa-solid fa-note-sticky"></i>
          </button>
          ${hasConstraints ? `<button class="btn btn-ghost btn-xs desk-ctx-rules" data-slot="${slotIdx}" title="Regler"><i class="fa-solid fa-sliders"></i></button>` : ''}
          <button class="btn btn-ghost btn-ghost-danger btn-xs desk-ctx-remove" data-slot="${slotIdx}" title="Fjern fra bord">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>`;
  }).filter(Boolean).join('');

  const hasStudents = desk.slots.some(s => s?.studentId);

  const menu = document.createElement('div');
  menu.id = '_desk-ctx-menu';
  menu.className = 'context-menu desk-context-menu-sticky';
  menu.style.cssText = `left:${event.clientX}px;top:${event.clientY}px;max-width:260px`;
  menu.innerHTML = `
    <div class="desk-ctx-header">
      <span style="font-size:11px;font-weight:600;opacity:0.5">Bord</span>
      <button class="btn btn-ghost btn-xs" id="_cm-close-btn"><i class="fa-solid fa-xmark"></i></button>
    </div>
    ${hasStudents ? `
    <div class="context-menu-divider"></div>
    <div style="padding:4px 8px 2px;font-size:10px;color:oklch(var(--bc)/0.4);text-transform:uppercase;letter-spacing:0.05em">Elever</div>
    ${studentRows}` : ''}
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" id="_cm-clear"><i class="fa-solid fa-eraser"></i> Fjern alle elever</div>
    <div class="context-menu-divider"></div>
    <div style="padding:4px 12px 2px;font-size:10px;color:oklch(var(--bc)/0.4);text-transform:uppercase;letter-spacing:0.05em">Bordfarge</div>
    <div style="padding:4px 12px 8px;display:flex;flex-wrap:wrap;gap:2px">${colorSwatches}</div>
    <div class="context-menu-divider"></div>
    <div style="padding:4px 12px 2px;font-size:10px;color:oklch(var(--bc)/0.4);text-transform:uppercase;letter-spacing:0.05em">Gruppe</div>
    <div style="padding:4px 12px 8px;display:flex;flex-wrap:wrap;gap:2px">${groupSwatches}</div>
  `;

  const closeMenu = () => menu.remove();

  menu.querySelector('#_cm-close-btn').addEventListener('click', closeMenu);
  menu.querySelector('#_cm-clear').addEventListener('click', () => {
    desk.slots = desk.slots.map(() => null); renderFn(); closeMenu();
  });
  menu.querySelectorAll('.desk-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => { desk.color = swatch.dataset.color; renderFn(); closeMenu(); });
  });
  menu.querySelectorAll('.desk-group-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      desk.groupId = swatch.dataset.group === '' ? null : parseInt(swatch.dataset.group, 10);
      renderFn(); closeMenu();
    });
  });

  // Per-student slot actions
  menu.querySelectorAll('.desk-ctx-lock').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.slot, 10);
      if (desk.slots[idx]) { desk.slots[idx].locked = !desk.slots[idx].locked; renderFn(); closeMenu(); }
    });
  });
  menu.querySelectorAll('.desk-ctx-note').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.slot, 10);
      closeMenu();
      openNoteModal(deskId, idx, chart, renderFn);
    });
  });
  menu.querySelectorAll('.desk-ctx-rules').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.slot, 10);
      const slot = desk.slots[idx];
      const student = slot?.studentId ? chart.studentsById[slot.studentId] : null;
      if (!student) return;
      const studentConstraints = (chart.constraints ?? []).filter(
        c => c.student_a === student.name || c.student_b === student.name
      );
      closeMenu();
      showManageRulesModal(student, studentConstraints, chart, renderFn);
    });
  });
  menu.querySelectorAll('.desk-ctx-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.slot, 10);
      desk.slots[idx] = null; renderFn(); closeMenu();
    });
  });

  getPortal().appendChild(menu);

  // Sticky: only close on mousedown outside the menu
  const outsideHandler = (e) => {
    if (!menu.contains(e.target)) { closeMenu(); document.removeEventListener('mousedown', outsideHandler); }
  };
  setTimeout(() => document.addEventListener('mousedown', outsideHandler), 0);

  // Viewport bounds correction
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    if (rect.right > vw)  menu.style.left = (event.clientX - rect.width) + 'px';
    if (rect.bottom > vh) menu.style.top  = (event.clientY - rect.height) + 'px';
  });
}

export function showStudentContextMenu(deskId, slotIdx, event, chart, renderFn, constraints) {
  const desk    = chart.desks.find(d => d.id === deskId);
  const slot    = desk?.slots[slotIdx];
  const student = slot ? chart.studentsById[slot.studentId] : null;
  if (!student) return;

  const studentConstraints = (constraints ?? []).filter(
    c => c.student_a === student.name || c.student_b === student.name
  );

  showContextMenu(event.clientX, event.clientY, [
    {
      label: slot.locked ? 'Lås opp posisjon' : 'Lås posisjon',
      icon: slot.locked ? 'fa-lock-open' : 'fa-lock',
      action: () => { slot.locked = !slot.locked; renderFn(); },
    },
    { label: 'Rediger notat', icon: 'fa-note-sticky', action: () => openNoteModal(deskId, slotIdx, chart, renderFn) },
    ...(studentConstraints.length > 0 ? [
      { divider: true },
      {
        label: `Administrer regler (${studentConstraints.length})`,
        icon: 'fa-sliders',
        action: () => showManageRulesModal(student, studentConstraints, chart, renderFn),
      },
    ] : []),
    { divider: true },
    { label: 'Fjern fra bord', icon: 'fa-user-minus', action: () => { desk.slots[slotIdx] = null; renderFn(); } },
  ], 'seating-ctx-menu');
}

/* ---- Notat-modal ---- */

export function openNoteModal(deskId, slotIdx, chart, renderFn) {
  const desk    = chart.desks.find(d => d.id === deskId);
  const slot    = desk?.slots[slotIdx];
  const student = slot ? chart.studentsById[slot.studentId] : null;
  if (!student) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal">
      <div class="modal-header">
        <span class="modal-title">Notat — ${_escHtml(student.name)}</span>
        <button class="btn btn-ghost btn-sm" id="btn-note-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <textarea id="note-textarea" class="textarea textarea-bordered w-full" style="min-height:120px;resize:vertical">${_escHtml(student.note ?? '')}</textarea>
      <div class="modal-footer">
        <button class="btn btn-ghost btn-sm" id="btn-note-cancel">Avbryt</button>
        <button class="btn btn-primary btn-sm" id="btn-note-save">Lagre</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#btn-note-close').addEventListener('click', close);
  backdrop.querySelector('#btn-note-cancel').addEventListener('click', close);
  backdrop.querySelector('#btn-note-save').addEventListener('click', () => {
    student.note = backdrop.querySelector('#note-textarea').value;
    close();
    renderFn();
  });
}

/* ---- Ny periode ---- */

export function openNewPeriodModal(chart, navigateFn) {
  if (!chart) return;
  if (!chart.id) { showToast('Lagre klassekart først før du starter ny periode', 'error'); return; }

  const currentWeek = getWeekNumber(new Date());
  const fromWeek = currentWeek;
  const toWeek   = currentWeek + 3;

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal" style="min-width:300px">
      <div class="modal-header"><span class="modal-title">Start ny periode</span></div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Fra uke</label>
        <input type="number" id="period-from" class="input input-bordered w-full" value="${fromWeek}" min="1" max="53">
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Til uke</label>
        <input type="number" id="period-to" class="input input-bordered w-full" value="${toWeek}" min="1" max="53">
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="period-cancel">Avbryt</button>
        <button class="btn btn-primary" id="period-ok">Opprett</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);
  backdrop.querySelector('#period-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#period-ok').addEventListener('click', async () => {
    const from = parseInt(backdrop.querySelector('#period-from').value, 10);
    const to   = parseInt(backdrop.querySelector('#period-to').value, 10);
    if (!from || !to || from > to) { showToast('Ugyldig ukeintervall', 'error'); return; }
    backdrop.remove();
    const comment = `Uke ${from}–${to}`;
    const name    = `${chart.name} (${comment})`;
    const result  = await window.api.duplicateSeating({ sourceId: chart.id, name, comment });
    if (result?.lastID) {
      showToast(`Ny periode opprettet: ${comment}`, 'success');
      navigateFn('seating-editor', { chartId: result.lastID });
    } else {
      showToast('Feil ved oppretting av periode', 'error');
    }
  });
}

/* ---- Hjelpefunksjoner ---- */

function _safeParseJSON(str) {
  if (!str) return null;
  try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return null; }
}

function _escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---- Administrer regler for elev (on-the-fly) ---- */

export function showManageRulesModal(student, studentConstraints, chart, renderFn) {
  const TYPE_LABELS = {
    always_together: 'Alltid sammen',
    never_together:  'Aldri sammen',
    opposite_side:   'Motsatt side',
    same_row:        'Samme rad',
    same_column:     'Samme kolonne',
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal" style="max-width:420px">
      <div class="modal-header">
        <i class="fa-solid fa-sliders" style="color:oklch(var(--p))"></i>
        <span class="modal-title">Regler for ${_escHtml(student.name)}</span>
        <button class="btn btn-ghost btn-sm" id="btn-rules-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <p style="font-size:12px;color:oklch(var(--bc)/0.5);margin-bottom:12px">
        Endringer gjelder kun dette kartet. Slett permanent for å fjerne fra databasen.
      </p>
      <div id="rules-list"></div>
      <div class="modal-footer" style="margin-top:12px">
        <button class="btn btn-ghost btn-sm" id="btn-rules-close2">Lukk</button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);

  const close = () => backdrop.remove();
  backdrop.querySelector('#btn-rules-close').addEventListener('click', close);
  backdrop.querySelector('#btn-rules-close2').addEventListener('click', close);

  function rebuildList() {
    const list = backdrop.querySelector('#rules-list');
    if (!list) return;

    if (studentConstraints.length === 0) {
      list.innerHTML = '<div style="font-size:13px;opacity:0.5;text-align:center;padding:16px">Ingen regler.</div>';
      return;
    }

    list.innerHTML = '';
    studentConstraints.forEach(c => {
      const other = c.student_a === student.name ? c.student_b : c.student_a;
      const typeLabel = TYPE_LABELS[c.type] ?? c.type;

      const row = document.createElement('div');
      row.className = 'rules-manage-row';
      row.innerHTML = `
        <div class="rules-manage-info">
          <span class="rules-manage-type">${_escHtml(typeLabel)}</span>
          <span class="rules-manage-name">${_escHtml(other)}</span>
        </div>
        <div class="rules-manage-actions">
          <button class="btn btn-ghost btn-xs" data-action="ignore" title="Ignorer for dette kartet">
            <i class="fa-solid fa-eye-slash"></i> Ignorer nå
          </button>
          <button class="btn btn-ghost btn-ghost-danger btn-xs" data-action="delete" title="Slett regel permanent">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      row.querySelector('[data-action="ignore"]').addEventListener('click', () => {
        const idx = chart.constraints.findIndex(x => x.id === c.id);
        if (idx !== -1) chart.constraints.splice(idx, 1);
        const ci = studentConstraints.indexOf(c);
        if (ci !== -1) studentConstraints.splice(ci, 1);
        renderFn();
        rebuildList();
        showToast('Regel ignorert for dette kartet', 'info');
      });
      row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const ok = await showConfirm({
          title: 'Slett regel?',
          message: 'Regelen slettes permanent og kan ikke gjenopprettes.',
          confirmText: 'Slett',
          danger: true,
        });
        if (!ok) return;
        await window.api.deleteConstraint(c.id);
        const idx = chart.constraints.findIndex(x => x.id === c.id);
        if (idx !== -1) chart.constraints.splice(idx, 1);
        const ci = studentConstraints.indexOf(c);
        if (ci !== -1) studentConstraints.splice(ci, 1);
        renderFn();
        rebuildList();
        showToast('Regel slettet permanent', 'success');
      });
      list.appendChild(row);
    });
  }

  rebuildList();
}

/* ---- Fun modes: Spin the wheel ---- */

/**
 * createSpinDrum(items, getLabelFn) — renders a roulette-tape drum widget.
 * Returns { el, spin(targetIdx, onDone) }
 * items: array of any
 * getLabelFn: (item) => string label
 */
function createSpinDrum(items, getLabelFn) {
  const ITEM_H = 44;
  const VISIBLE = 5;
  const DRUM_H = ITEM_H * VISIBLE;

  // Triple the list for seamless looping feel during fast spin
  const repeated = [...items, ...items, ...items];

  const drum = document.createElement('div');
  drum.className = 'spin-drum';
  drum.style.cssText = `height:${DRUM_H}px;overflow:hidden;position:relative;border-radius:12px;background:oklch(var(--b2));border:2px solid oklch(var(--b3))`;

  const list = document.createElement('ul');
  list.className = 'spin-list';
  list.style.cssText = `list-style:none;margin:0;padding:0;will-change:transform`;

  repeated.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'spin-item';
    li.style.cssText = `height:${ITEM_H}px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;opacity:0.35;transition:opacity 0.1s`;
    li.textContent = getLabelFn(item);
    li.dataset.origIdx = i % items.length;
    list.appendChild(li);
  });
  drum.appendChild(list);

  // Highlight stripe at center
  const stripe = document.createElement('div');
  stripe.style.cssText = `
    position:absolute;left:0;right:0;
    top:${ITEM_H * Math.floor(VISIBLE / 2)}px;
    height:${ITEM_H}px;
    border-top:2px solid oklch(var(--p)/0.7);
    border-bottom:2px solid oklch(var(--p)/0.7);
    background:oklch(var(--p)/0.08);
    pointer-events:none;
  `;
  drum.appendChild(stripe);

  // Track current translateY
  let currentY = 0;
  const setY = (y) => {
    currentY = y;
    list.style.transform = `translateY(${y}px)`;
    // Highlight centered item
    const centerItemIdx = Math.round(-y / ITEM_H);
    list.querySelectorAll('.spin-item').forEach((li, i) => {
      li.style.opacity = i === centerItemIdx ? '1' : '0.35';
      li.style.transform = i === centerItemIdx ? 'scale(1.06)' : 'scale(1)';
    });
  };
  setY(0);

  function spin(targetIdx, onDone) {
    // Land on the targetIdx in the middle copy (offset by items.length to use second copy)
    const finalItemInList = items.length + targetIdx;
    const finalY = -(finalItemInList * ITEM_H) + Math.floor(VISIBLE / 2) * ITEM_H;

    // Extra full rotations for drama (2-4 full cycles)
    const extraRounds = (2 + Math.floor(Math.random() * 3)) * items.length * ITEM_H;
    const startY = currentY;
    const totalTravel = Math.abs(finalY - extraRounds - startY);
    const targetY = finalY - extraRounds;

    const duration = 2400 + Math.random() * 600;
    const startTime = performance.now();

    // Easing: ease-out-quart
    const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

    let rafId;
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutQuart(progress);
      const y = startY + (targetY - startY) * eased;
      setY(y);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setY(targetY);
        if (onDone) onDone();
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }

  return { el: drum, spin };
}

export function showSpinPlacementModal(chart, renderFn) {
  if (!chart) return;

  const placedIds = new Set();
  chart.desks.forEach(d => d.slots.forEach(s => { if (s?.studentId) placedIds.add(s.studentId); }));
  const unplaced = chart.students.filter(s => !placedIds.has(s.id));

  if (unplaced.length === 0) {
    showToast('Alle elever er allerede plassert!', 'info');
    return;
  }

  const emptySlots = [];
  chart.desks.forEach(d => {
    d.slots.forEach((s, i) => {
      if (!s?.studentId) {
        const deskIdx = chart.desks.findIndex(x => x.id === d.id);
        emptySlots.push({ deskId: d.id, slotIdx: i, label: `Bord ${deskIdx + 1}${d.slots.length > 1 ? ', plass ' + (i + 1) : ''}` });
      }
    });
  });

  if (emptySlots.length === 0) {
    showToast('Ingen ledige plasser.', 'warning');
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal" style="max-width:440px;text-align:center">
      <div class="modal-header">
        <i class="fa-solid fa-chair" style="color:oklch(var(--p))"></i>
        <span class="modal-title">Plasserings-spin</span>
        <button class="btn btn-ghost btn-sm" id="btn-spin-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div style="margin-bottom:14px">
        <label class="form-label" style="text-align:left;display:block;margin-bottom:6px">Velg elev å plassere:</label>
        <select id="spin-student-select" class="select select-bordered w-full">
          ${unplaced.map(s => `<option value="${s.id}">${_escHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div id="spin-drum-wrap" style="margin-bottom:14px"></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="btn-spin-close2">Avbryt</button>
        <button class="btn btn-secondary" id="btn-do-spin">
          <i class="fa-solid fa-rotate"></i> Trekk plass
        </button>
        <button class="btn btn-primary hidden" id="btn-confirm-placement">
          <i class="fa-solid fa-check"></i> Plasser her
        </button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);

  const { el: drumEl, spin } = createSpinDrum(emptySlots, s => s.label);
  backdrop.querySelector('#spin-drum-wrap').appendChild(drumEl);

  const close = () => backdrop.remove();
  backdrop.querySelector('#btn-spin-close').addEventListener('click', close);
  backdrop.querySelector('#btn-spin-close2').addEventListener('click', close);

  let chosenSlot = null;
  let spinning = false;

  backdrop.querySelector('#btn-do-spin').addEventListener('click', () => {
    if (spinning) return;
    spinning = true;
    chosenSlot = null;
    const confirmBtn = backdrop.querySelector('#btn-confirm-placement');
    confirmBtn.classList.add('hidden');

    const targetIdx = Math.floor(Math.random() * emptySlots.length);
    spin(targetIdx, () => {
      spinning = false;
      chosenSlot = emptySlots[targetIdx];
      confirmBtn.classList.remove('hidden');
    });
  });

  backdrop.querySelector('#btn-confirm-placement').addEventListener('click', () => {
    if (!chosenSlot) return;
    const studentId = backdrop.querySelector('#spin-student-select').value;
    const desk = chart.desks.find(d => d.id === chosenSlot.deskId);
    if (desk) {
      desk.slots[chosenSlot.slotIdx] = { studentId, locked: false, note: '' };
      renderFn();
      close();
      showToast('Elev plassert!', 'success');
    }
  });
}

export function showSpinStudentModal(chart) {
  if (!chart) return;
  const allStudents = chart.students ?? [];
  if (allStudents.length === 0) { showToast('Ingen elever i klassen.', 'warning'); return; }

  // Maintain a remaining list for "Neste elev" feature
  let remaining = [...allStudents];

  const backdrop = document.createElement('div');
  backdrop.className = 'kp-backdrop';
  backdrop.innerHTML = `
    <div class="kp-modal" style="max-width:400px;text-align:center">
      <div class="modal-header">
        <i class="fa-solid fa-person-rays" style="color:oklch(var(--p))"></i>
        <span class="modal-title">Trekk en elev</span>
        <button class="btn btn-ghost btn-sm" id="btn-stu-spin-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div id="stu-drum-wrap" style="margin-bottom:14px"></div>
      <div id="spin-winner-badge" class="hidden" style="font-size:14px;font-weight:700;padding:8px 16px;border-radius:8px;background:oklch(var(--su)/0.15);border:1.5px solid oklch(var(--su)/0.4);color:oklch(var(--suc,var(--bc)));margin-bottom:10px"></div>
      <div style="font-size:11px;opacity:0.5;margin-bottom:10px" id="spin-remaining-label">${remaining.length} elever gjenstår</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="btn-stu-spin-close2">Lukk</button>
        <button class="btn btn-ghost btn-sm hidden" id="btn-reset-spin" title="Start på nytt med alle elever">
          <i class="fa-solid fa-arrows-rotate"></i> Nullstill
        </button>
        <button class="btn btn-secondary" id="btn-do-stu-spin">
          <i class="fa-solid fa-rotate"></i> Trekk!
        </button>
        <button class="btn btn-primary hidden" id="btn-next-student">
          <i class="fa-solid fa-forward"></i> Neste elev
        </button>
      </div>
    </div>
  `;
  getPortal().appendChild(backdrop);

  let drumObj = createSpinDrum(remaining, s => s.name);
  backdrop.querySelector('#stu-drum-wrap').appendChild(drumObj.el);

  const rebuildDrum = () => {
    backdrop.querySelector('#stu-drum-wrap').innerHTML = '';
    drumObj = createSpinDrum(remaining, s => s.name);
    backdrop.querySelector('#stu-drum-wrap').appendChild(drumObj.el);
    backdrop.querySelector('#spin-remaining-label').textContent = `${remaining.length} elever gjenstår`;
  };

  const close = () => backdrop.remove();
  backdrop.querySelector('#btn-stu-spin-close').addEventListener('click', close);
  backdrop.querySelector('#btn-stu-spin-close2').addEventListener('click', close);

  let spinning = false;
  let lastWinner = null;

  const doSpin = () => {
    if (spinning || remaining.length === 0) return;
    spinning = true;
    const winnerBadge = backdrop.querySelector('#spin-winner-badge');
    const nextBtn = backdrop.querySelector('#btn-next-student');
    const resetBtn = backdrop.querySelector('#btn-reset-spin');
    winnerBadge.classList.add('hidden');
    nextBtn.classList.add('hidden');

    const targetIdx = Math.floor(Math.random() * remaining.length);
    drumObj.spin(targetIdx, () => {
      spinning = false;
      lastWinner = remaining[targetIdx];
      winnerBadge.textContent = `🎉 ${lastWinner.name}`;
      winnerBadge.classList.remove('hidden');
      nextBtn.classList.remove('hidden');
      resetBtn.classList.remove('hidden');
    });
  };

  backdrop.querySelector('#btn-do-stu-spin').addEventListener('click', doSpin);

  backdrop.querySelector('#btn-next-student').addEventListener('click', () => {
    if (!lastWinner) return;
    remaining = remaining.filter(s => s.id !== lastWinner.id);
    if (remaining.length === 0) {
      backdrop.querySelector('#spin-winner-badge').textContent = 'Alle elever er trukket!';
      backdrop.querySelector('#btn-next-student').classList.add('hidden');
      backdrop.querySelector('#btn-do-stu-spin').disabled = true;
      backdrop.querySelector('#spin-remaining-label').textContent = '0 elever gjenstår';
      return;
    }
    rebuildDrum();
    doSpin();
  });

  backdrop.querySelector('#btn-reset-spin').addEventListener('click', () => {
    remaining = [...allStudents];
    lastWinner = null;
    backdrop.querySelector('#spin-winner-badge').classList.add('hidden');
    backdrop.querySelector('#btn-next-student').classList.add('hidden');
    backdrop.querySelector('#btn-do-stu-spin').disabled = false;
    rebuildDrum();
  });
}

/* ---- Constraint bekreftelsesdialog ---- */

export function showConstraintConfirm(violations) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'kp-backdrop';
    backdrop.innerHTML = `
      <div class="kp-modal" style="max-width:360px">
        <div class="modal-header">
          <i class="fa-solid fa-triangle-exclamation" style="color:oklch(var(--wa))"></i>
          <span class="modal-title">Plasserings­regel brytes</span>
        </div>
        <p style="font-size:13px;margin-bottom:16px">
          ${violations.map(v => `<span>${_escHtml(v)}</span>`).join('<br>')}
        </p>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="cc-cancel">Avbryt</button>
          <button class="btn btn-error btn-sm" id="cc-confirm">Flytt likevel</button>
        </div>
      </div>`;
    getPortal().appendChild(backdrop);
    backdrop.querySelector('#cc-cancel').addEventListener('click',  () => { backdrop.remove(); resolve(false); });
    backdrop.querySelector('#cc-confirm').addEventListener('click', () => { backdrop.remove(); resolve(true);  });
  });
}
